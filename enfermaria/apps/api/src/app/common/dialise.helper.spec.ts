import { ganhoInterdialitico, ufObjetivoMl, ganhoExcessivo } from './dialise.helper';

describe('dialise.helper', () => {
  it('ganhoInterdialitico = pré − pós anterior', () => {
    expect(ganhoInterdialitico(72.5, 70)).toBe(2.5);
  });

  it('ufObjetivoMl = (pré − seco) × 1000, nunca negativo', () => {
    expect(ufObjetivoMl(72, 70)).toBe(2000);
    expect(ufObjetivoMl(69, 70)).toBe(0);
  });

  it('ganhoExcessivo: > 2.5 kg absoluto', () => {
    expect(ganhoExcessivo(3.0)).toBe(true);
    expect(ganhoExcessivo(2.0)).toBe(false);
  });

  it('ganhoExcessivo: > 4% do peso seco', () => {
    expect(ganhoExcessivo(2.0, 45)).toBe(true); // 2/45 = 4.4%
    expect(ganhoExcessivo(2.0, 70)).toBe(false); // 2/70 = 2.9%
  });
});
