import {
  enqueue, flushMutationQueue, getQueue, getQueueLength, clearQueue, definirDonoDaFila, MAX_OPERACOES, MAX_BYTES_OPERACAO,
  estadoSincronizacao, limparDescartadas, aoMudarFila,
} from './mutation-queue';
import { chamadas, falharCom, limpar } from '../test-doubles/api';
import AsyncStorage from '../test-doubles/async-storage';
import * as SecureStore from '../test-doubles/secure-store';
import { guardarCifrado, lerCifrado } from './armazem-cifrado';

/**
 * Estes testes existem por um motivo concreto: a fila transporta administrações de
 * medicação feitas sem rede. Cada cenário aqui corresponde a uma forma real de a versão
 * anterior duplicar ou perder um acto clínico.
 */

const administracao = {
  method: 'POST' as const,
  url: '/medicacao/registar',
  body: { medicacaoId: 'med-1', doenteId: 'doente-1' },
};

function erroDeRede() {
  return Object.assign(new Error('sem rede'), { response: undefined });
}
function erroHttp(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

beforeEach(async () => {
  limpar();
  (AsyncStorage as any).__limpar();
  SecureStore.__limpar();
  await clearQueue();
  await definirDonoDaFila('enf-a');
});

describe('fila de mutações offline', () => {
  it('envia cada operação uma só vez e esvazia a fila', async () => {
    await enqueue(administracao);
    const r = await flushMutationQueue();

    expect(chamadas).toHaveLength(1);
    expect(r).toEqual({ sucesso: 1, falha: 0, descartadas: 0 });
    expect(await getQueueLength()).toBe(0);
  });

  it('manda uma Idempotency-Key estável, para o servidor reconhecer um reenvio', async () => {
    await enqueue(administracao);
    const [op] = await getQueue();

    await flushMutationQueue();

    expect(chamadas[0].idempotencyKey).toBe(op.id);
    expect(chamadas[0].idempotencyKey).toBeTruthy();
  });

  it('NÃO duplica quando vários flushes disparam ao mesmo tempo (reconexão)', async () => {
    // O caso real: N componentes com escuta própria do NetInfo, todos a disparar o
    // flush no mesmo evento de reconexão.
    await enqueue(administracao);

    const resultados = await Promise.all([
      flushMutationQueue(),
      flushMutationQueue(),
      flushMutationQueue(),
      flushMutationQueue(),
    ]);

    expect(chamadas).toHaveLength(1);
    // Todos observam o mesmo resultado, em vez de cada um iniciar o seu envio.
    expect(resultados.every((r) => r.sucesso === 1)).toBe(true);
    expect(await getQueueLength()).toBe(0);
  });

  it('NÃO perde uma operação enfileirada durante o flush', async () => {
    // A versão anterior terminava o flush escrevendo a lista de falhados por cima da
    // chave inteira — o registo criado entretanto desaparecia sem deixar rasto.
    await enqueue(administracao);

    let durante: Promise<void> | null = null;
    falharCom(() => {
      if (!durante) {
        durante = enqueue({
          method: 'POST',
          url: '/sinais-vitais',
          body: { doenteId: 'doente-1', fc: 88 },
        });
      }
      return null;
    });

    await flushMutationQueue();
    await durante;

    const restantes = await getQueue();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].url).toBe('/sinais-vitais');
  });

  it('mantém na fila o que falhou por rede, para reenviar depois', async () => {
    await enqueue(administracao);
    falharCom(() => erroDeRede());

    const r = await flushMutationQueue();

    expect(r.sucesso).toBe(0);
    expect(r.falha).toBe(1);
    expect(await getQueueLength()).toBe(1);
  });

  it('desiste de um pedido que o servidor recusa por ser inválido', async () => {
    // Um 400 não melhora por insistir: repetir para sempre esconde o problema do
    // enfermeiro, que fica a pensar que o registo foi guardado.
    await enqueue(administracao);
    falharCom(() => erroHttp(400));

    const r = await flushMutationQueue();

    expect(r.descartadas).toBe(1);
    expect(await getQueueLength()).toBe(0);
  });

  it('desiste ao fim de três tentativas de erro de servidor', async () => {
    await enqueue(administracao);
    falharCom(() => erroHttp(500));

    await flushMutationQueue();
    expect(await getQueueLength()).toBe(1);
    await flushMutationQueue();
    expect(await getQueueLength()).toBe(1);
    const terceiro = await flushMutationQueue();

    expect(terceiro.descartadas).toBe(1);
    expect(await getQueueLength()).toBe(0);
  });

  it('preserva a ordem por que os actos foram registados', async () => {
    await enqueue({ ...administracao, body: { ordem: 1 } });
    await enqueue({ ...administracao, body: { ordem: 2 } });
    await enqueue({ ...administracao, body: { ordem: 3 } });

    await flushMutationQueue();

    expect(chamadas.map((c) => (c.body as any).ordem)).toEqual([1, 2, 3]);
  });

  it('sobrevive a uma fila corrompida em vez de bloquear a app', async () => {
    await AsyncStorage.setItem('curasphere:mutation_queue', '{isto não é JSON válido');

    await expect(getQueue()).resolves.toEqual([]);
    await expect(flushMutationQueue()).resolves.toEqual({ sucesso: 0, falha: 0, descartadas: 0 });
  });

  it('escritas concorrentes não se atropelam', async () => {
    // Sem o mútex, o ler-modificar-escrever de cada `enqueue` perdia entradas.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        enqueue({ method: 'POST', url: '/sinais-vitais', body: { i } }),
      ),
    );

    expect(await getQueueLength()).toBe(20);
  });
});

describe('fila offline num dispositivo partilhado (A9)', () => {
  it('só envia os actos de quem tem a sessão aberta', async () => {
    await enqueue(administracao); // registado pela enf-a
    await definirDonoDaFila('enf-b');

    await flushMutationQueue();
    expect(chamadas).toHaveLength(0);
    expect(await getQueue()).toHaveLength(1);

    await definirDonoDaFila('enf-a');
    await flushMutationQueue();
    expect(chamadas).toHaveLength(1);
    expect(await getQueue()).toHaveLength(0);
  });

  it('pára se a sessão mudar a meio do envio', async () => {
    await enqueue({ ...administracao, body: { ordem: 1 } });
    await enqueue({ ...administracao, body: { ordem: 2 } });
    // Outra pessoa entra enquanto o primeiro acto está a ser enviado.
    falharCom(() => {
      void definirDonoDaFila('enf-b');
      return null;
    });

    await flushMutationQueue();

    expect(chamadas).toHaveLength(1);
    expect(await getQueue()).toHaveLength(1);
  });

  it('o aviso de sincronização conta só os actos desta sessão', async () => {
    await enqueue(administracao);
    await definirDonoDaFila('enf-b');

    expect(await getQueueLength()).toBe(0);
  });

  it('sem sessão, recusa guardar — o ecrã tem de mostrar que não ficou registado', async () => {
    await definirDonoDaFila(null);

    await expect(enqueue(administracao)).rejects.toThrow(/sessão/i);
    expect(await getQueue()).toHaveLength(0);
  });

  it('actos de antes da actualização ficam da primeira sessão que os encontra', async () => {
    await AsyncStorage.setItem(
      'curasphere:mutation_queue',
      JSON.stringify([{ id: 'antigo', method: 'POST', url: '/medicacao/registar', timestamp: 1, tentativas: 0 }]),
    );

    await definirDonoDaFila('enf-a');

    expect((await getQueue())[0].dono).toBe('enf-a');
  });

  it('sem rede, as tentativas não se gastam', async () => {
    await enqueue(administracao);
    falharCom(() => erroDeRede());

    for (let i = 0; i < 5; i++) await flushMutationQueue();

    const [op] = await getQueue();
    expect(op.tentativas).toBe(0);
  });

  it('uma sessão expirada (401) não apaga o acto', async () => {
    // O envio antes do logout pode apanhar o token já caducado.
    await enqueue(administracao);
    falharCom(() => erroHttp(401));

    for (let i = 0; i < 5; i++) await flushMutationQueue();

    expect(await getQueue()).toHaveLength(1);
  });
});

describe('armazenamento da fila (PERF-18)', () => {
  it('cada operação tem a sua chave: enfileirar não reescreve as outras', async () => {
    for (let i = 0; i < 10; i++) await enqueue({ ...administracao, body: { i } });
    const escritas: string[] = [];
    const original = AsyncStorage.setItem;
    (AsyncStorage as any).setItem = async (k: string, v: string) => { escritas.push(k); return original(k, v); };
    try {
      await enqueue({ ...administracao, body: { i: 10 } });
    } finally {
      (AsyncStorage as any).setItem = original;
    }
    // No AsyncStorage só o índice; a operação nova vai cifrada (e as 10 antigas não se reescrevem).
    expect(escritas).toEqual(['curasphere:mq:indice']);
    expect(await getQueueLength()).toBe(11);
  });

  it('o flush apaga só as operações enviadas e mantém a ordem das restantes', async () => {
    await enqueue({ ...administracao, body: { ordem: 1 } });
    await enqueue({ ...administracao, body: { ordem: 2 } });
    let n = 0;
    falharCom(() => (n++ === 1 ? erroDeRede() : null)); // a 2.ª falha (sem rede)
    await flushMutationQueue();
    const fila = await getQueue();
    expect(fila.map((o) => (o.body as any).ordem)).toEqual([2]);
    expect(await lerCifrado(`curasphere:mq:op:${fila[0].id}`)).not.toBeNull();
  });

  it(`recusa mais de ${MAX_OPERACOES} operações por enviar — o ecrã diz que NÃO ficou guardado`, async () => {
    for (let i = 0; i < MAX_OPERACOES; i++) await enqueue({ ...administracao, body: { i } });
    await expect(enqueue(administracao)).rejects.toThrow(/Fila offline cheia/);
    expect(await getQueueLength()).toBe(MAX_OPERACOES);
  });

  it('recusa um registo maior do que o limite por operação', async () => {
    await expect(enqueue({ ...administracao, body: { notas: 'x'.repeat(MAX_BYTES_OPERACAO) } })).rejects.toThrow(/demasiado grande/);
    expect(await getQueueLength()).toBe(0);
  });

  it('migra a fila do formato antigo (uma só chave) sem perder nem duplicar', async () => {
    await AsyncStorage.setItem('curasphere:mutation_queue', JSON.stringify([
      { id: 'a1', method: 'POST', url: '/x', timestamp: 1, tentativas: 0, dono: 'enf-a' },
      { id: 'a2', method: 'POST', url: '/y', timestamp: 2, tentativas: 1, dono: 'enf-a' },
    ]));
    expect((await getQueue()).map((o) => o.id)).toEqual(['a1', 'a2']);
    expect(await AsyncStorage.getItem('curasphere:mutation_queue')).toBeNull();
    expect((await getQueue()).map((o) => o.id)).toEqual(['a1', 'a2']);
  });

  it('fila antiga corrompida: guardada à parte para análise, e a app segue', async () => {
    await AsyncStorage.setItem('curasphere:mutation_queue', '{nao e json');
    expect(await getQueue()).toEqual([]);
    expect(await lerCifrado('curasphere:mq:corrompida')).toBe('{nao e json');
    expect(await AsyncStorage.getItem('curasphere:mq:corrompida')).toBeNull();
  });

  it('uma operação ilegível sai do índice sem bloquear as outras', async () => {
    await enqueue({ ...administracao, body: { ordem: 1 } });
    await enqueue({ ...administracao, body: { ordem: 2 } });
    const [primeira] = await getQueue();
    await guardarCifrado(`curasphere:mq:op:${primeira.id}`, '{lixo');
    expect((await getQueue()).map((o) => (o.body as any).ordem)).toEqual([2]);
  });
});

describe('fila cifrada (ARQ-26)', () => {
  it('o conteúdo clínico não fica em claro no AsyncStorage', async () => {
    await enqueue({ ...administracao, body: { notas: 'Dor torácica, 8/10' } });
    const [op] = await getQueue();
    expect(await AsyncStorage.getItem(`curasphere:mq:op:${op.id}`)).toBeNull();
    expect(await lerCifrado(`curasphere:mq:op:${op.id}`)).toContain('Dor torácica');
  });

  it('uma operação acima dos 2 KB do SecureStore guarda-se em blocos e lê-se inteira', async () => {
    const notas = 'á'.repeat(6000); // 12 000 bytes em UTF-8
    await enqueue({ ...administracao, body: { notas } });
    const [op] = await getQueue();
    expect((op.body as any).notas).toBe(notas);
    expect(SecureStore.__chaves().filter((k) => k.startsWith('curasphere_mq_op_')).length).toBeGreaterThan(3);
  });

  it('as operações que versões antigas deixaram em claro passam para o armazenamento cifrado', async () => {
    await AsyncStorage.setItem('curasphere:mq:indice', JSON.stringify(['v1']));
    await AsyncStorage.setItem('curasphere:mq:op:v1', JSON.stringify({ id: 'v1', method: 'POST', url: '/x', timestamp: 1, tentativas: 0, dono: 'enf-a' }));
    expect((await getQueue()).map((o) => o.id)).toEqual(['v1']);
    expect(await AsyncStorage.getItem('curasphere:mq:op:v1')).toBeNull();
    expect(await lerCifrado('curasphere:mq:op:v1')).toContain('"v1"');
  });

  it('enviar ou limpar a fila apaga também os blocos cifrados', async () => {
    await enqueue({ ...administracao, body: { ordem: 1 } });
    await clearQueue();
    expect(SecureStore.__chaves().filter((k) => k.startsWith('curasphere_mq_op_'))).toEqual([]);
  });
});

describe('estado da sincronização para o aviso (UX-24)', () => {
  it('pendentes, última sincronização e descartadas com o motivo — e só os desta sessão', async () => {
    expect((await estadoSincronizacao()).ultimaSincronizacao).toBeNull();
    await enqueue({ ...administracao, body: { ordem: 1 } });
    expect((await estadoSincronizacao()).pendentes).toHaveLength(1);

    falharCom(() => Object.assign(new Error('HTTP 400'), { response: { status: 400, data: { message: 'doente incorrecto' } } }));
    await flushMutationQueue();
    const e = await estadoSincronizacao();
    expect(e.pendentes).toHaveLength(0);
    expect(e.descartadas).toEqual([expect.objectContaining({ url: '/medicacao/registar', motivo: 'doente incorrecto', dono: 'enf-a' })]);
    expect(e.ultimaSincronizacao).toEqual(expect.any(Number));

    await definirDonoDaFila('enf-b');
    expect((await estadoSincronizacao()).descartadas).toHaveLength(0);
    await definirDonoDaFila('enf-a');
    await limparDescartadas();
    expect((await estadoSincronizacao()).descartadas).toHaveLength(0);
  });

  it('sem rede, a última sincronização não avança', async () => {
    await enqueue(administracao);
    falharCom(() => erroDeRede());
    await flushMutationQueue();
    expect((await estadoSincronizacao()).ultimaSincronizacao).toBeNull();
  });

  it('enfileirar e sincronizar avisam quem mostra o estado', async () => {
    const chamadasAviso: number[] = [];
    const parar = aoMudarFila(() => chamadasAviso.push(1));
    await enqueue(administracao);
    await flushMutationQueue();
    parar();
    await enqueue(administracao);
    expect(chamadasAviso).toHaveLength(2);
  });
});
