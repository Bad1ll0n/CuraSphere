import { superficieCorporal, doseQuimio, toxicidadeAcionavel } from './oncologia.helper';

describe('oncologia.helper', () => {
  it('superficieCorporal (Mosteller)', () => {
    expect(superficieCorporal(70, 170)).toBeCloseTo(1.82, 2); // √(170*70/3600)
    expect(superficieCorporal(0, 170)).toBe(0);
  });

  it('doseQuimio = mg/m² × BSA', () => {
    expect(doseQuimio(100, 1.8)).toEqual({ doseMg: 180, limitada: false });
  });

  it('doseQuimio respeita a dose máxima', () => {
    expect(doseQuimio(100, 1.8, 150)).toEqual({ doseMg: 150, limitada: true });
    expect(doseQuimio(100, 1.8, 200)).toEqual({ doseMg: 180, limitada: false });
  });

  it('toxicidadeAcionavel para CTCAE ≥ 3', () => {
    expect(toxicidadeAcionavel(3)).toBe(true);
    expect(toxicidadeAcionavel(2)).toBe(false);
    expect(toxicidadeAcionavel(null)).toBe(false);
  });
});
