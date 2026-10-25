import { calcularDPP, semanasGestacao, fcFetalAnormal } from './obstetricia.helper';

describe('obstetricia.helper', () => {
  it('calcularDPP = DUM + 280 dias', () => {
    const dpp = calcularDPP('2024-01-01');
    expect(dpp.toISOString().slice(0, 10)).toBe('2024-10-07'); // 2024-01-01 + 280d
  });

  it('semanasGestacao conta semanas e dias', () => {
    const ref = new Date('2024-01-01');
    expect(semanasGestacao(new Date('2023-08-14'), ref)).toEqual({ semanas: 20, dias: 0 }); // 140 dias
    expect(semanasGestacao(new Date('2023-12-30'), ref)).toEqual({ semanas: 0, dias: 2 });
  });

  it('semanasGestacao devolve null fora do intervalo plausível', () => {
    expect(semanasGestacao(new Date('2020-01-01'), new Date('2024-01-01'))).toBeNull(); // > 320 dias
    expect(semanasGestacao(new Date('2024-06-01'), new Date('2024-01-01'))).toBeNull(); // futuro
  });

  it('fcFetalAnormal classifica bradicardia/taquicardia', () => {
    expect(fcFetalAnormal(100)).toBe('bradicardia');
    expect(fcFetalAnormal(170)).toBe('taquicardia');
    expect(fcFetalAnormal(140)).toBeNull();
  });
});
