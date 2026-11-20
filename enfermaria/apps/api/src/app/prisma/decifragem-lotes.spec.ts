import { cifrarSegredo, decifrarSemBloquear, LOTE_DECIFRAGEM } from './encryption.middleware';

/** PERF-16 — listas grandes decifram-se por lotes, cedendo o event loop entre eles. */
describe('decifragem sem bloquear (PERF-16)', () => {
  const linhas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), nome: cifrarSegredo(`Doente ${i}`) }));

  it('decifra todas as linhas de uma lista grande', async () => {
    const l = linhas(LOTE_DECIFRAGEM * 3 + 7);
    await decifrarSemBloquear('Doente', l);
    expect(l.every((x, i) => x.nome === `Doente ${i}`)).toBe(true);
  });

  it('cede o event loop entre lotes: um callback agendado corre antes de terminar', async () => {
    const l = linhas(LOTE_DECIFRAGEM * 4);
    let correuNoMeio = false;
    let decifradasQuandoCorreu = -1;
    setImmediate(() => { correuNoMeio = true; decifradasQuandoCorreu = l.filter((x) => !String(x.nome).startsWith('enc:')).length; });
    await decifrarSemBloquear('Doente', l);
    expect(correuNoMeio).toBe(true);
    expect(decifradasQuandoCorreu).toBeGreaterThan(0);
    expect(decifradasQuandoCorreu).toBeLessThan(l.length);
  });

  it('listas pequenas e objetos decifram-se de uma vez, como antes', async () => {
    const um = { id: 'x', nome: cifrarSegredo('Ana') };
    expect((await decifrarSemBloquear('Doente', um)).nome).toBe('Ana');
    const poucas = linhas(3);
    await decifrarSemBloquear('Doente', poucas);
    expect(poucas.map((x) => x.nome)).toEqual(['Doente 0', 'Doente 1', 'Doente 2']);
  });
});
