import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { apagarCifrado, guardarCifrado, lerCifrado } from './armazem-cifrado';

/** Formato antigo: a fila inteira num só JSON (migrado na primeira leitura). */
const QUEUE_KEY = 'curasphere:mutation_queue';
/** PERF-18: um índice pequeno (só ids, por ordem) e uma chave por operação. */
const KEY_INDICE = 'curasphere:mq:indice';
const keyOp = (id: string) => `curasphere:mq:op:${id}`;
const KEY_CORROMPIDA = 'curasphere:mq:corrompida';
/** UX-24: última sincronização e operações descartadas — para o aviso persistente da app. */
const KEY_ESTADO = 'curasphere:mq:estado';
const MAX_DESCARTADAS = 20;

export interface Descartada { id: string; method: string; url: string; timestamp: number; dono?: string; motivo: string }
interface EstadoGuardado { ultimaSincronizacao: number | null; descartadas: Descartada[] }

/** Quem mostra o estado da fila (o aviso) ouve aqui: enfileirar e sincronizar avisam. */
const ouvintes = new Set<() => void>();
export function aoMudarFila(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}
const avisar = () => ouvintes.forEach((fn) => { try { fn(); } catch { /* um ouvinte não pára os outros */ } });

async function lerEstado(): Promise<EstadoGuardado> {
  try {
    const raw = await AsyncStorage.getItem(KEY_ESTADO);
    const e = raw ? JSON.parse(raw) : null;
    return { ultimaSincronizacao: typeof e?.ultimaSincronizacao === 'number' ? e.ultimaSincronizacao : null, descartadas: Array.isArray(e?.descartadas) ? e.descartadas : [] };
  } catch {
    return { ultimaSincronizacao: null, descartadas: [] };
  }
}

/** O que ESTA sessão tem por enviar, o que foi descartado e quando sincronizou pela última vez. */
export async function estadoSincronizacao(): Promise<{ pendentes: QueuedOp[]; descartadas: Descartada[]; ultimaSincronizacao: number | null }> {
  const [fila, estado] = await Promise.all([getQueue(), emExclusao(lerEstado)]);
  return {
    pendentes: fila.filter(doDonoActual),
    descartadas: estado.descartadas.filter((d) => donoActual !== null && d.dono === donoActual),
    ultimaSincronizacao: estado.ultimaSincronizacao,
  };
}

/** O enfermeiro viu a lista dos descartados: deixa de os mostrar. */
export async function limparDescartadas(): Promise<void> {
  await emExclusao(async () => {
    const e = await lerEstado();
    await AsyncStorage.setItem(KEY_ESTADO, JSON.stringify({ ...e, descartadas: e.descartadas.filter((d) => d.dono !== donoActual) }));
  });
  avisar();
}
const MAX_TENTATIVAS = 3;
/**
 * PERF-18: limites. Um turno de 12 h com rede a falhar não chega perto de 300 atos; uma
 * administração ou um registo de vitais tem poucas centenas de bytes. O que passar disto é
 * erro (o ecrã diz que NÃO ficou guardado) — não é uma fila que cresce até a app ficar lenta
 * ou o armazenamento recusar a escrita a meio.
 */
export const MAX_OPERACOES = 300;
export const MAX_BYTES_OPERACAO = 64 * 1024;

export interface QueuedOp {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  timestamp: number;
  /** Tentativas de envio já gastas. Persistido para sobreviver ao fecho da app. */
  tentativas?: number;
  /** Quem registou o acto. Só a sessão dessa pessoa o pode enviar (A9). */
  dono?: string;
}

/**
 * Fila de mutações offline (MB-02 / MB-12).
 *
 * Esta fila transporta actos clínicos — administrações de medicação, registos de sinais
 * vitais — feitos sem rede à cabeceira do doente. Duplicar uma entrada é registar um
 * medicamento que foi dado uma vez como tendo sido dado duas; perder uma é o contrário.
 * Ambos são incidentes de segurança do doente, não bugs de sincronização.
 *
 * A versão anterior tinha quatro caminhos para isso:
 *
 *  1. `useNetworkStatus` era um hook, e cada componente que o usava registava a sua
 *     própria escuta do NetInfo. Ao reconectar, N componentes disparavam N
 *     `flushMutationQueue()` em paralelo, todos a ler a mesma fila e a reenviar as
 *     mesmas operações.
 *  2. O flush não tinha guarda de reentrância.
 *  3. `enqueue` fazia ler-modificar-escrever sobre a chave inteira, e o flush terminava
 *     escrevendo por cima com a lista de falhados — uma operação enfileirada durante o
 *     flush desaparecia sem deixar rasto.
 *  4. Não havia chave de idempotência: um pedido que chegasse ao servidor mas cuja
 *     resposta se perdesse era reenviado, e o servidor não tinha como saber que já o
 *     tinha executado.
 *
 * O que segue fecha os quatro: acesso serializado por mútex, flush de disparo único,
 * remoção por id em vez de substituição da fila, e `Idempotency-Key` por operação.
 */

/**
 * Mútex por encadeamento de promessas. O AsyncStorage não tem operação de
 * ler-modificar-escrever atómica, por isso a atomicidade é imposta aqui: toda a
 * leitura e escrita da fila passa por esta cadeia, e nunca se sobrepõem.
 */
let cadeia: Promise<unknown> = Promise.resolve();

function emExclusao<T>(fn: () => Promise<T>): Promise<T> {
  const proximo = cadeia.then(fn, fn);
  // A cadeia nunca pode ficar rejeitada, senão bloqueia todas as operações seguintes.
  cadeia = proximo.then(
    () => undefined,
    () => undefined,
  );
  return proximo;
}

/**
 * A9: a fila é do dispositivo, mas cada acto clínico é de uma pessoa. O envio usa o token de
 * quem tiver a sessão aberta nesse momento — e o servidor regista o acto em nome dessa
 * sessão. Num dispositivo partilhado entre turnos, o enfermeiro que saía sem rede deixava as
 * administrações na fila, e elas seguiam mais tarde com a sessão do seguinte: ficavam
 * registadas como feitas por quem não as fez.
 *
 * Cada operação guarda agora o dono, e só a sessão dele a envia. O que é de outra pessoa não
 * se apaga — espera que ela volte a entrar. `auth.ts` mantém isto actualizado no login, ao
 * restaurar a sessão e no logout.
 */
let donoActual: string | null = null;

export async function definirDonoDaFila(utilizadorId: string | null): Promise<void> {
  donoActual = utilizadorId;
  if (!utilizadorId) return;
  // Operações enfileiradas antes de a fila guardar o dono ficam para a primeira sessão que as
  // encontra. É um risco residual de uma só vez, limitado ao que já estava na fila quando a
  // app foi actualizada — e a alternativa, deixá-las sem dono, era nunca as enviar.
  await emExclusao(async () => {
    const fila = await lerFilaCrua();
    for (const o of fila) if (!o.dono) await escreverOp({ ...o, dono: utilizadorId });
  });
}

const doDonoActual = (o: QueuedOp) => donoActual !== null && o.dono === donoActual;

/**
 * Identificador único por operação. Serve de `id` na fila e de `Idempotency-Key` no
 * pedido, para que o servidor reconheça um reenvio da mesma administração.
 */
function novoId(): string {
  const r = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${r()}${r()}`;
}

/**
 * PERF-18: a fila era um único JSON reescrito por inteiro a cada enfileirar, a cada flush e a
 * cada mudança de sessão — com a fila a crescer, cada ato à cabeceira reescrevia todos os outros
 * (e um erro a meio de uma escrita grande podia perdê-los a todos). Agora cada operação tem a sua
 * chave e o índice só guarda ids: enfileirar escreve uma operação e o índice; o flush apaga só as
 * que saíram e reescreve só as que mudaram.
 */
async function lerIndice(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INDICE);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const escreverIndice = (ids: string[]) => AsyncStorage.setItem(KEY_INDICE, JSON.stringify(ids));
// ARQ-26: o conteúdo de cada operação (dados clínicos) vai cifrado para o SecureStore; no
// AsyncStorage ficam só o índice de ids e o estado da sincronização.
const escreverOp = (op: QueuedOp) => guardarCifrado(keyOp(op.id), JSON.stringify(op));
const apagarOp = async (id: string) => { await apagarCifrado(keyOp(id)); await AsyncStorage.removeItem(keyOp(id)); };

/** Lê uma operação; as que versões antigas deixaram em claro passam para o armazenamento cifrado. */
async function lerOp(id: string): Promise<string | null> {
  const cifrada = await lerCifrado(keyOp(id));
  if (cifrada != null) return cifrada;
  const emClaro = await AsyncStorage.getItem(keyOp(id));
  if (emClaro == null) return null;
  await guardarCifrado(keyOp(id), emClaro);
  await AsyncStorage.removeItem(keyOp(id));
  return emClaro;
}

/** Migra o formato antigo (uma só chave) para uma chave por operação. Corre sob o mútex. */
async function migrarFormatoAntigo(): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (raw == null) return;
  let antigas: QueuedOp[] = [];
  try {
    const lista = JSON.parse(raw);
    antigas = Array.isArray(lista) ? lista.filter((o) => o && typeof o.id === 'string') : [];
  } catch {
    // Fila corrompida: não se inventa conteúdo clínico, mas guarda-se o que lá estava para
    // análise em vez de o apagar — e a app segue.
    await guardarCifrado(KEY_CORROMPIDA, raw); // ARQ-26: também é conteúdo clínico
  }
  const indice = await lerIndice();
  for (const op of antigas) if (!indice.includes(op.id)) { await escreverOp(op); indice.push(op.id); }
  await escreverIndice(indice);
  await AsyncStorage.removeItem(QUEUE_KEY);
}

async function lerFilaCrua(): Promise<QueuedOp[]> {
  await migrarFormatoAntigo();
  const ids = await lerIndice();
  const ops = await Promise.all(ids.map(async (id) => {
    try {
      const raw = await lerOp(id);
      return raw ? (JSON.parse(raw) as QueuedOp) : null;
    } catch {
      return null;
    }
  }));
  const validas = ops.filter((o): o is QueuedOp => !!o && typeof o.id === 'string');
  // Entradas do índice sem operação (escrita interrompida) saem do índice.
  if (validas.length !== ids.length) await escreverIndice(validas.map((o) => o.id));
  return validas;
}

export async function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp' | 'dono'>): Promise<void> {
  // Sem sessão não há a quem atribuir o acto. Recusar aqui faz o ecrã mostrar que o registo
  // NÃO ficou guardado — em vez de o guardar para seguir em nome de outra pessoa.
  const dono = donoActual;
  if (!dono) throw new Error('Sem sessão activa: o registo não pode ficar na fila offline');
  const nova: QueuedOp = { ...op, id: novoId(), timestamp: Date.now(), tentativas: 0, dono };
  if (JSON.stringify(nova).length > MAX_BYTES_OPERACAO) {
    throw new Error('Registo demasiado grande para guardar sem rede — tente de novo com ligação.');
  }
  await emExclusao(async () => {
    const indice = (await lerFilaCrua()).map((o) => o.id);
    if (indice.length >= MAX_OPERACOES) {
      throw new Error(`Fila offline cheia (${MAX_OPERACOES} registos por enviar) — o registo NÃO ficou guardado. Procure rede para sincronizar.`);
    }
    // A operação primeiro, o índice depois: uma escrita interrompida deixa no máximo uma
    // operação órfã (ignorada), nunca um índice a apontar para nada.
    await escreverOp(nova);
    await escreverIndice([...indice, nova.id]);
  });
  avisar();
}

export async function getQueue(): Promise<QueuedOp[]> {
  return emExclusao(lerFilaCrua);
}

/** O que ESTA sessão tem por enviar — é o que o aviso de sincronização deve contar. */
export async function getQueueLength(): Promise<number> {
  return (await getQueue()).filter(doDonoActual).length;
}

/**
 * Envia uma operação. O `Idempotency-Key` é o id da operação na fila e mantém-se igual
 * em todas as retentativas — é isso que permite ao servidor distinguir "o enfermeiro
 * administrou duas vezes" de "o mesmo registo chegou duas vezes".
 */
async function enviar(op: QueuedOp): Promise<void> {
  const config = { headers: { 'Idempotency-Key': op.id } };
  const metodo = op.method.toLowerCase() as 'post' | 'patch' | 'put' | 'delete';

  if (metodo === 'delete') {
    await (api as any).delete(op.url, config);
    return;
  }
  await (api as any)[metodo](op.url, op.body, config);
}

/**
 * Um 4xx normalmente não melhora com retentativas — o pedido é que está errado. As
 * excepções são as que descrevem uma condição TEMPORÁRIA:
 *
 *  - 408/429: pediram para tentar mais tarde.
 *  - **409**: conflito. O servidor devolve-o enquanto um pedido com a mesma chave de
 *    idempotência ainda está a decorrer — e devolvia-o também quando o Redis caía.
 *    Classificá-lo como definitivo fazia esta fila **descartar a administração de
 *    medicação para sempre**, em silêncio, por causa de uma dependência não-crítica.
 *
 * Na dúvida sobre um acto clínico, o erro certo é insistir, não deitar fora.
 */
function vaiMelhorarSeRepetir(erro: any): boolean {
  const status = erro?.response?.status;
  if (typeof status !== 'number') return true; // erro de rede: vale a pena repetir
  // 401: a sessão caducou. O acto está certo, falta a sessão. Com o envio antes do logout,
  // tratá-lo como definitivo apagava administrações só porque o token tinha expirado.
  if (status === 401 || status === 408 || status === 409 || status === 429) return true;
  return status >= 500;
}

/**
 * Só gasta uma tentativa o pedido que o servidor chegou a avaliar. Sem rede, ou sem sessão,
 * o acto nunca foi julgado — e contar essas falhas fazia um enfermeiro que saísse três vezes
 * sem rede perder o que tinha registado.
 */
function gastaTentativa(erro: any): boolean {
  const status = erro?.response?.status;
  return typeof status === 'number' && status !== 401;
}

let flushEmCurso: Promise<{ sucesso: number; falha: number; descartadas: number }> | null = null;

export async function flushMutationQueue(): Promise<{
  sucesso: number;
  falha: number;
  descartadas: number;
}> {
  // Disparo único: quem chegar a meio de um flush recebe o mesmo resultado em vez de
  // iniciar um segundo. É esta linha que impede a duplicação por reconexão.
  if (flushEmCurso) return flushEmCurso;

  flushEmCurso = (async () => {
    // Só os actos de quem tem a sessão aberta: o token com que seguem é o dessa pessoa (A9).
    const fila = (await getQueue()).filter(doDonoActual);
    if (fila.length === 0) return { sucesso: 0, falha: 0, descartadas: 0 };

    const concluidas = new Set<string>();
    const descartadas = new Set<string>();
    const motivos = new Map<string, string>();
    let houveRede = true;
    const avaliadas = new Set<string>();
    let sucesso = 0;
    let falha = 0;

    for (const op of fila) {
      // A sessão pode mudar a meio do envio (saída com rede lenta, outra pessoa a entrar): o
      // acto só segue enquanto o dono continuar a ser quem tem a sessão aberta.
      if (!doDonoActual(op)) break;
      try {
        await enviar(op);
        concluidas.add(op.id);
        sucesso++;
      } catch (erro) {
        const gasta = gastaTentativa(erro);
        if (typeof (erro as any)?.response?.status !== 'number') houveRede = false;
        if (gasta) avaliadas.add(op.id);
        const tentativas = (op.tentativas ?? 0) + (gasta ? 1 : 0);
        if (!vaiMelhorarSeRepetir(erro) || tentativas >= MAX_TENTATIVAS) {
          // Deixar uma operação a tentar para sempre esconde o problema do enfermeiro.
          // Sai da fila e conta como descartada, para a interface o poder dizer.
          descartadas.add(op.id);
          const status = (erro as any)?.response?.status;
          motivos.set(op.id, (erro as any)?.response?.data?.message ?? (status ? `HTTP ${status}` : 'sem resposta'));
        }
        falha++;
      }
    }

    // Remoção por id sobre a fila ACTUAL, não substituição pela lista antiga: qualquer
    // operação enfileirada enquanto isto corria continua lá.
    await emExclusao(async () => {
      const actual = await lerFilaCrua();
      const sair = (o: QueuedOp) => concluidas.has(o.id) || descartadas.has(o.id);
      // O índice primeiro (sem as que saíram), depois as chaves: o pior caso é uma chave órfã.
      await escreverIndice(actual.filter((o) => !sair(o)).map((o) => o.id));
      for (const o of actual) {
        if (sair(o)) await apagarOp(o.id);
        else if (avaliadas.has(o.id)) await escreverOp({ ...o, tentativas: (o.tentativas ?? 0) + 1 });
      }
      // UX-24: o que foi descartado fica à vista (não some em silêncio) e a hora da última
      // sincronização só avança quando o servidor respondeu.
      const estado = await lerEstado();
      const novas: Descartada[] = actual.filter((o) => descartadas.has(o.id)).map((o) => ({ id: o.id, method: o.method, url: o.url, timestamp: o.timestamp, dono: o.dono, motivo: String(motivos.get(o.id) ?? '').slice(0, 200) }));
      await AsyncStorage.setItem(KEY_ESTADO, JSON.stringify({
        ultimaSincronizacao: houveRede ? Date.now() : estado.ultimaSincronizacao,
        descartadas: [...novas, ...estado.descartadas].slice(0, MAX_DESCARTADAS),
      }));
    });
    avisar();

    return { sucesso, falha, descartadas: descartadas.size };
  })();

  try {
    return await flushEmCurso;
  } finally {
    flushEmCurso = null;
  }
}

export async function clearQueue(): Promise<void> {
  await emExclusao(async () => {
    for (const id of await lerIndice()) await apagarOp(id);
    await AsyncStorage.removeItem(KEY_INDICE);
    await AsyncStorage.removeItem(QUEUE_KEY);
    await AsyncStorage.removeItem(KEY_ESTADO);
  });
  avisar();
}
