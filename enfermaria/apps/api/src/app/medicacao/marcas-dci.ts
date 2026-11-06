// QA-06 — marcas comerciais → substância activa (DCI).
//
// A prescrição é texto livre e o catálogo de medicamentos ainda não é obrigatório. Em
// Portugal prescreve-se e fala-se pela marca ("Ben-u-ron", "Brufen", "Clamoxyl"), e o
// verificador de alergias só conhecia substâncias: com alergia a paracetamol, prescrever
// "Ben-u-ron" passava sem aviso — na prescrição e na administração.
//
// Esta tabela é uma rede de segurança para as marcas mais comuns em enfermaria, NÃO um
// substituto da prescrição codificada pelo catálogo (DCI + CNPEM), que continua a ser o
// objectivo. Chave: nome da marca normalizado (minúsculas, sem acentos nem separadores).

import { normalizarTermo } from './alergias.helper';

const MARCAS: Record<string, string> = {
  // Analgésicos / antipiréticos / AINEs
  benuron: 'paracetamol', panadol: 'paracetamol', dafalgan: 'paracetamol', perfalgan: 'paracetamol',
  tylenol: 'paracetamol', supofen: 'paracetamol',
  brufen: 'ibuprofeno', nurofen: 'ibuprofeno', spidifen: 'ibuprofeno', trifene: 'ibuprofeno',
  voltaren: 'diclofenac', olfen: 'diclofenac', flameril: 'diclofenac',
  aspirina: 'acetilsalicilico', aspegic: 'acetilsalicilico', cartia: 'acetilsalicilico', tromalyt: 'acetilsalicilico',
  nolotil: 'metamizol', dolocalma: 'metamizol',
  naprosyn: 'naproxeno', feldene: 'piroxicam', toradol: 'cetorolaco', nimed: 'nimesulida',
  arcoxia: 'etoricoxib', celebrex: 'celecoxib',
  // Opióides
  tramal: 'tramadol', zaldiar: 'tramadol paracetamol', durogesic: 'fentanilo', actiq: 'fentanilo',
  oxycontin: 'oxicodona', targin: 'oxicodona', mst: 'morfina', sevredol: 'morfina',
  transtec: 'buprenorfina', palexia: 'tapentadol',
  // Antibióticos
  clamoxyl: 'amoxicilina', amoxil: 'amoxicilina', augmentin: 'amoxicilina clavulanico',
  clavamox: 'amoxicilina clavulanico', floxapen: 'flucloxacilina', tazocin: 'piperacilina tazobactam',
  zinnat: 'cefuroxima', rocephin: 'ceftriaxona', keflex: 'cefalexina', kefzol: 'cefazolina',
  fortum: 'ceftazidima', meronem: 'meropenem', tienam: 'imipenem', invanz: 'ertapenem',
  bactrim: 'sulfametoxazol trimetoprim', zithromax: 'azitromicina', klacid: 'claritromicina',
  ciproxina: 'ciprofloxacina', ciproxin: 'ciprofloxacina', tavanic: 'levofloxacina', avelox: 'moxifloxacina',
  vancocina: 'vancomicina', dalacin: 'clindamicina', flagyl: 'metronidazol', zyvoxid: 'linezolida',
  targocid: 'teicoplanina', diflucan: 'fluconazol', zovirax: 'aciclovir',
  // Anticoagulantes / antiagregantes
  lovenox: 'enoxaparina', clexane: 'enoxaparina', fragmin: 'dalteparina', fraxiparine: 'nadroparina',
  arixtra: 'fondaparinux', xarelto: 'rivaroxabano', eliquis: 'apixabano', pradaxa: 'dabigatrano',
  lixiana: 'edoxabano', varfine: 'varfarina', sintrom: 'acenocumarol', plavix: 'clopidogrel',
  brilique: 'ticagrelor',
  // Cardiovasculares
  renitec: 'enalapril', tritace: 'ramipril', coversyl: 'perindopril', zestril: 'lisinopril',
  zocor: 'sinvastatina', lipitor: 'atorvastatina', zarator: 'atorvastatina', crestor: 'rosuvastatina',
  lasix: 'furosemida', aldactone: 'espironolactona', lanoxin: 'digoxina', cordarone: 'amiodarona',
  concor: 'bisoprolol', norvasc: 'amlodipina', cozaar: 'losartan', diovan: 'valsartan',
  // Endócrino
  risidon: 'metformina', glucophage: 'metformina', lantus: 'insulina glargina', toujeo: 'insulina glargina',
  novorapid: 'insulina aspart', humalog: 'insulina lispro', levemir: 'insulina detemir',
  actrapid: 'insulina', humulin: 'insulina', zyloric: 'alopurinol',
  // Gastro
  losec: 'omeprazol', pantoc: 'pantoprazol', nexium: 'esomeprazol', zantac: 'ranitidina',
  primperan: 'metoclopramida', zofran: 'ondansetron',
  // SNC
  valium: 'diazepam', victan: 'loflazepato', xanax: 'alprazolam', lorenin: 'lorazepam',
  dormicum: 'midazolam', haldol: 'haloperidol', risperdal: 'risperidona', zyprexa: 'olanzapina',
  seroquel: 'quetiapina', tegretol: 'carbamazepina', depakine: 'valproato', keppra: 'levetiracetam',
  lyrica: 'pregabalina', neurontin: 'gabapentina',
  // Respiratório / corticóides
  ventolin: 'salbutamol', atrovent: 'ipratropio', solumedrol: 'metilprednisolona',
  urbason: 'metilprednisolona', solucortef: 'hidrocortisona', decadron: 'dexametasona',
  // Anestesia / contraste
  xylocaina: 'lidocaina', marcaina: 'bupivacaina', naropeina: 'ropivacaina', diprivan: 'propofol',
  omnipaque: 'iohexol', visipaque: 'iodixanol',
};

/** Todas as substâncias que a tabela conhece (para saber se um nome é reconhecível). */
export const DCI_CONHECIDAS = new Set(
  Object.values(MARCAS).flatMap((d) => d.split(' ')),
);

export interface MarcaReconhecida {
  /** Como aparece no texto (normalizado). */
  marca: string;
  /** Substância(s) activa(s). */
  dci: string;
}

/**
 * Marcas presentes num texto. Aceita a marca escrita com separadores ("Ben-u-ron",
 * "Solu-Medrol") ou partida em várias palavras — junta até 4 palavras seguidas.
 */
export function marcasNoTexto(texto: string): MarcaReconhecida[] {
  const palavras = normalizarTermo(texto).split(/[\s+]+/).filter(Boolean);
  const encontradas: MarcaReconhecida[] = [];
  for (let i = 0; i < palavras.length; i++) {
    for (let j = i + 1; j <= Math.min(palavras.length, i + 4); j++) {
      const chave = palavras.slice(i, j).join('');
      const dci = MARCAS[chave];
      if (dci && !encontradas.some((e) => e.marca === chave)) encontradas.push({ marca: chave, dci });
    }
  }
  return encontradas;
}

/** O texto com as substâncias das marcas acrescentadas (para o verificador de alergias). */
export function expandirMarcas(texto: string): string {
  const marcas = marcasNoTexto(texto);
  return marcas.length ? `${texto} ${marcas.map((m) => m.dci).join(' ')}` : texto;
}
