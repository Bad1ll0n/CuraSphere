import {
  enqueue, flushMutationQueue, getQueue, getQueueLength, clearQueue, definirDonoDaFila,
} from './mutation-queue';
import { chamadas, falharCom, limpar } from '../test-doubles/api';
import AsyncStorage from '../test-doubles/async-storage';

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
