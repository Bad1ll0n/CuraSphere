import { BarramentoService } from '../redis/barramento.service';
import { gravarCacheSessao, invalidarCacheSessao, lerCacheSessao, limparCacheSessao } from './sessao-cache';
import { SessaoCacheSincronizacao } from './sessao-cache.sync';

/** ARQ-17/OPS-09 — revogar uma sessão numa réplica apaga a cache em todas (via barramento). */
describe('SessaoCacheSincronizacao', () => {
  afterEach(() => limparCacheSessao());

  it('invalidar difunde pelo barramento; receber a difusão apaga a entrada local', () => {
    const barramento = new BarramentoService({ get: () => undefined } as any);
    const publicar = jest.spyOn(barramento, 'publicar');
    const sync = new SessaoCacheSincronizacao(barramento);
    sync.onModuleInit();

    gravarCacheSessao('u1', { versaoSessao: 1, ativo: true });
    invalidarCacheSessao('u1');
    expect(publicar).toHaveBeenCalledWith('sessao:invalidar', 'u1');
    expect(lerCacheSessao('u1')).toBeUndefined();

    // Outra réplica revogou: a mensagem chega e apaga a entrada desta.
    gravarCacheSessao('u2', { versaoSessao: 1, ativo: true });
    barramento.publicar('sessao:invalidar', 'u2');
    expect(lerCacheSessao('u2')).toBeUndefined();
    sync.onModuleDestroy();
  });
});
