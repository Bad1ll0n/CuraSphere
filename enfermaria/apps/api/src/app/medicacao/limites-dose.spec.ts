import { eSOS, frequenciaValida, parsearDose, tomasPorDia, verificarDoseMaxima } from './limites-dose';

// QA-07 — "Morfina 1000 mg 1/1h" e "x / abc / quando apetecer" eram aceites sem aviso.
describe('parsearDose', () => {
  it.each([
    ['1 g', 1, 'g', 1000], ['500mg', 500, 'mg', 500], ['2,5 mg', 2.5, 'mg', 2.5], ['875/125 mg', 875, 'mg', 875],
    ['250 mcg', 250, 'mcg', 0.25], ['10 UI', 10, 'UI', null], ['1 comp', 1, 'comp', null], ['5 ml', 5, 'ml', null],
  ])('"%s" → %s %s', (txt, valor, unidade, mg) => {
    expect(parsearDose(txt)).toEqual({ valor, unidade, mg });
  });
  it.each(['abc', '', 'mg', '0 mg', 'meia ampola', '10 xpto'])('"%s" não é legível', (txt) => expect(parsearDose(txt)).toBeNull());
});

describe('frequenciaValida', () => {
  it.each(['3x/dia', '8/8h', 'q6h', 'SOS', 'em SOS', 'contínua', 'Contínuo', 'perfusão', 'dose única'])('"%s" é aceite', (f) =>
    expect(frequenciaValida(f)).toBe(true));
  it.each(['quando apetecer', '', 'às vezes', '5x/dia'])('"%s" é recusada', (f) => expect(frequenciaValida(f)).toBe(false));
});

describe('verificarDoseMaxima', () => {
  const d = (txt: string) => parsearDose(txt)!;
  it('apanha a dose por toma acima do máximo (morfina 1000 mg)', () => {
    expect(verificarDoseMaxima('Morfina', d('1000 mg'), 24)?.motivo).toMatch(/por toma excede o máximo de adulto de morfina/);
  });
  it('apanha a dose diária acima do máximo (paracetamol 1 g 6x/dia = 6 g)', () => {
    expect(verificarDoseMaxima('Paracetamol', d('1 g'), tomasPorDia('6x/dia'))?.motivo).toMatch(/6 g\/24 h excede o máximo diário de paracetamol \(4 g\)/);
  });
  it('reconhece a marca (Ben-u-ron 2 g)', () => {
    expect(verificarDoseMaxima('Ben-u-ron', d('2 g'), 4)).not.toBeNull();
  });
  it('dose normal passa', () => {
    expect(verificarDoseMaxima('Paracetamol', d('1 g'), tomasPorDia('4x/dia'))).toBeNull();
    expect(verificarDoseMaxima('Amoxicilina', d('875/125 mg'), tomasPorDia('2x/dia'))).toBeNull();
  });
  it('unidades sem conversão para mg e fármacos fora da tabela não são avaliados', () => {
    expect(verificarDoseMaxima('Insulina', d('100 UI'), 1)).toBeNull();
    expect(verificarDoseMaxima('Xpto', d('5000 mg'), 1)).toBeNull();
  });
  it('em SOS usa o máximo de tomas por dia', () => {
    expect(verificarDoseMaxima('Tramadol', d('100 mg'), 6)?.motivo).toMatch(/600 mg\/24 h/);
    expect(verificarDoseMaxima('Tramadol', d('100 mg'), null)).toBeNull();
  });
  it('eSOS', () => {
    expect(eSOS('SOS')).toBe(true);
    expect(eSOS('8/8h')).toBe(false);
  });
});
