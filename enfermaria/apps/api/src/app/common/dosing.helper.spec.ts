import { calcularDosePediatrica } from './dosing.helper';

describe('calcularDosePediatrica', () => {
  it('calcula dose = mg/kg × peso', () => {
    const r = calcularDosePediatrica({ mgPorKg: 15, pesoKg: 20 });
    expect(r.doseMg).toBe(300);
    expect(r.limitadaPorMaximo).toBe(false);
  });

  it('limita ao máximo (dose de adulto)', () => {
    const r = calcularDosePediatrica({ mgPorKg: 15, pesoKg: 80, doseMaximaMg: 1000 });
    expect(r.doseMg).toBe(1000);
    expect(r.limitadaPorMaximo).toBe(true);
    expect(r.aviso).toMatch(/limitada/i);
  });

  it('calcula a dose diária total pela frequência', () => {
    const r = calcularDosePediatrica({ mgPorKg: 10, pesoKg: 12, frequenciaDia: 3 });
    expect(r.doseMg).toBe(120);
    expect(r.doseDiariaMg).toBe(360);
  });

  it('rejeita peso ou dose não positivos', () => {
    expect(calcularDosePediatrica({ mgPorKg: 10, pesoKg: 0 }).doseMg).toBe(0);
    expect(calcularDosePediatrica({ mgPorKg: 0, pesoKg: 10 }).aviso).toMatch(/positiv/i);
  });
});
