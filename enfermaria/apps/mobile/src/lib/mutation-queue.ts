import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const QUEUE_KEY = 'curasphere:mutation_queue';
const MAX_TENTATIVAS = 3;

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
    if (!fila.some((o) => !o.dono)) return;
    await escreverFila(fila.map((o) => (o.dono ? o : { ...o, dono: utilizadorId })));
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

async function lerFilaCrua(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    // Fila corrompida: não se pode inventar conteúdo clínico, mas também não se pode
    // deixar a app presa a lê-la para sempre. Trata-se como vazia e segue.
    return [];
  }
}

async function escreverFila(ops: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}

export async function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp' | 'dono'>): Promise<void> {
  // Sem sessão não há a quem atribuir o acto. Recusar aqui faz o ecrã mostrar que o registo
  // NÃO ficou guardado — em vez de o guardar para seguir em nome de outra pessoa.
  const dono = donoActual;
  if (!dono) throw new Error('Sem sessão activa: o registo não pode ficar na fila offline');
  await emExclusao(async () => {
    const queue = await lerFilaCrua();
    queue.push({ ...op, id: novoId(), timestamp: Date.now(), tentativas: 0, dono });
    await escreverFila(queue);
  });
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
        if (gasta) avaliadas.add(op.id);
        const tentativas = (op.tentativas ?? 0) + (gasta ? 1 : 0);
        if (!vaiMelhorarSeRepetir(erro) || tentativas >= MAX_TENTATIVAS) {
          // Deixar uma operação a tentar para sempre esconde o problema do enfermeiro.
          // Sai da fila e conta como descartada, para a interface o poder dizer.
          descartadas.add(op.id);
        }
        falha++;
      }
    }

    // Remoção por id sobre a fila ACTUAL, não substituição pela lista antiga: qualquer
    // operação enfileirada enquanto isto corria continua lá.
    await emExclusao(async () => {
      const actual = await lerFilaCrua();
      const restantes = actual
        .filter((o) => !concluidas.has(o.id) && !descartadas.has(o.id))
        .map((o) => (avaliadas.has(o.id) ? { ...o, tentativas: (o.tentativas ?? 0) + 1 } : o));
      await escreverFila(restantes);
    });

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
    await AsyncStorage.removeItem(QUEUE_KEY);
  });
}
