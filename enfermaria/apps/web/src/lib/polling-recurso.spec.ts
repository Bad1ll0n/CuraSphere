import { iniciarPollingDeRecurso, intervaloDeRecurso, SEGURANCA_MS } from './use-socket';

describe('polling só como recurso (PERF-13)', () => {
  it('com o canal ligado, passa à rede de segurança; sem canal, mantém o intervalo curto', () => {
    expect(intervaloDeRecurso(true, 8_000)).toBe(SEGURANCA_MS);
    expect(intervaloDeRecurso(false, 8_000)).toBe(8_000);
  });

  it('SSE ligado não carrega a cada 8 s; SSE em baixo carrega', () => {
    jest.useFakeTimers();
    const carregar = jest.fn();
    const p = iniciarPollingDeRecurso(carregar, 8_000);
    p.canal(true);
    jest.advanceTimersByTime(60_000);
    expect(carregar).not.toHaveBeenCalled();
    p.canal(false);
    jest.advanceTimersByTime(8_000);
    expect(carregar).toHaveBeenCalledTimes(1);
    p.parar();
    jest.useRealTimers();
  });
});
