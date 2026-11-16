import { BarramentoService } from './barramento.service';

/** ARQ-17/OPS-09 — sem Redis, o barramento entrega localmente (o comportamento de uma réplica). */
describe('BarramentoService', () => {
  const semRedis = () => new BarramentoService({ get: () => undefined } as any);

  it('sem REDIS_URL, publicar entrega aos subscritores locais do mesmo canal', () => {
    const b = semRedis();
    b.onModuleInit();
    const recebidos: unknown[] = [];
    b.subscrever('sse:camas', (m) => recebidos.push(m));
    b.subscrever('outro', () => recebidos.push('não devia'));
    b.publicar('sse:camas', { type: 'cama_atualizada', data: '{}' });
    expect(recebidos).toEqual([{ type: 'cama_atualizada', data: '{}' }]);
  });

  it('cancelar a subscrição deixa de entregar', () => {
    const b = semRedis();
    const ouvinte = jest.fn();
    const cancelar = b.subscrever('c', ouvinte);
    cancelar();
    b.publicar('c', 1);
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
