import { compararComAlergenio, detetarConflitoAlergia, nomeReconhecido } from './alergias.helper';
import { expandirMarcas, marcasNoTexto } from './marcas-dci';
import { eAltoRisco } from './alto-risco';

// QA-06: prescrição pela marca comercial tem de bater na alergia à substância.
describe('marcas comerciais → DCI', () => {
  it.each([
    ['Ben-u-ron 1 g', 'Paracetamol'],
    ['ben u ron', 'paracetamol'],
    ['Brufen 400mg', 'Ibuprofeno'],
    ['Nurofen', 'AINEs'],
    ['Voltaren', 'diclofenac'],
    ['Clamoxyl 1g', 'Penicilina'],
    ['Augmentin 875/125', 'amoxicilina'],
    ['Zinnat', 'cefuroxima'],
    ['Rocephin 2g', 'Penicilinas'],   // cruzada penicilinas ↔ cefalosporinas
    ['Tramal', 'opioides'],
    ['Clexane 40 mg', 'heparina'],
    ['Nolotil', 'metamizol'],
    ['Bactrim forte', 'sulfas'],
    ['Solu-Medrol', 'metilprednisolona'],
  ])('"%s" com alergia a "%s" → conflito', (prescrito, alergenio) => {
    expect(compararComAlergenio(prescrito, alergenio)).not.toBeNull();
  });

  it('a mensagem explica a marca', () => {
    const c = detetarConflitoAlergia('Ben-u-ron 1 g', [{ alergenio: 'Paracetamol', severidade: 'anafilaxia' }]);
    expect(c?.correspondencia.motivo).toMatch(/Ben-u-ron 1 g contém paracetamol/);
  });

  it('alergia escrita pela marca também conta', () => {
    expect(compararComAlergenio('Ibuprofeno 400mg', 'Brufen')).not.toBeNull();
  });

  it.each([
    ['Ben-u-ron', 'Penicilina'],
    ['Brufen', 'Paracetamol'],
    ['Lasix', 'ovo'],
  ])('"%s" com alergia a "%s" → sem conflito', (prescrito, alergenio) => {
    expect(compararComAlergenio(prescrito, alergenio)).toBeNull();
  });

  it('expandirMarcas acrescenta a substância e deixa o resto igual', () => {
    expect(expandirMarcas('Ben-u-ron 1 g')).toBe('Ben-u-ron 1 g paracetamol');
    expect(expandirMarcas('Paracetamol 1 g')).toBe('Paracetamol 1 g');
    expect(marcasNoTexto('Augmentin + Ben-u-ron').map((m) => m.dci)).toEqual(['amoxicilina clavulanico', 'paracetamol']);
  });
});

describe('nomeReconhecido', () => {
  it.each(['Ben-u-ron', 'Paracetamol 1 g', 'Amoxicilina', 'Lasix', 'Enoxaparina'])('"%s" é reconhecido', (n) =>
    expect(nomeReconhecido(n)).toBe(true));
  it.each(['Xpto 50mg', 'comprimido azul'])('"%s" não é reconhecido', (n) => expect(nomeReconhecido(n)).toBe(false));
});

// UX-01: fármacos de alto risco pedem barreira reforçada na administração.
describe('eAltoRisco', () => {
  it.each(['Morfina 10 mg', 'Sevredol', 'Insulina glargina', 'Lantus', 'Cloreto de potássio 7,45%', 'KCl 10 mEq',
    'Enoxaparina 40mg', 'Clexane', 'Xarelto 20 mg', 'Varfarina', 'Tramadol 100mg'])('"%s" é de alto risco', (n) =>
    expect(eAltoRisco(n)).toBe(true));
  it.each(['Paracetamol 1 g', 'Ben-u-ron', 'Amoxicilina', 'Omeprazol 20mg'])('"%s" não é de alto risco', (n) =>
    expect(eAltoRisco(n)).toBe(false));
});
