import { UNIDADES_DOSE } from '@org/shared';
import { parsearDose } from './limites-dose';
import { doseComposta } from './prescricao-entrada';

// UX-17: a dose estruturada compõe o texto que o resto do sistema já lê (MAR, PDFs, limites).
describe('UX-17 — dose estruturada', () => {
  it('compõe "valor unidade" com vírgula decimal; sem estrutura fica o texto', () => {
    expect(doseComposta({ doseValor: 500, doseUnidade: 'mg' })).toBe('500 mg');
    expect(doseComposta({ doseValor: 0.5, doseUnidade: 'mg' })).toBe('0,5 mg');
    expect(doseComposta({ doseValor: 1.25, doseUnidade: 'comp' })).toBe('1,25 comp');
    expect(doseComposta({ dose: ' 1 g ' })).toBe('1 g');
    expect(doseComposta({ dose: '1 g', doseValor: 2, doseUnidade: 'g' })).toBe('2 g'); // a estrutura ganha
  });

  it.each(UNIDADES_DOSE as unknown as string[])('a unidade %s é lida pelo parser dos limites de dose', (u) => {
    const d = parsearDose(doseComposta({ doseValor: 2.5, doseUnidade: u }));
    expect(d).not.toBeNull();
    expect(d?.valor).toBe(2.5);
  });

  it('as unidades de massa convertem para mg (a verificação da dose máxima depende disso)', () => {
    expect(parsearDose(doseComposta({ doseValor: 1, doseUnidade: 'g' }))?.mg).toBe(1000);
    expect(parsearDose(doseComposta({ doseValor: 500, doseUnidade: 'mcg' }))?.mg).toBeCloseTo(0.5);
  });
});
