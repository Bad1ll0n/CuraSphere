// QA-07 — plausibilidade da prescrição: dose legível, frequência reconhecida e doses máximas.
//
// Verificado na revisão: "Morfina 1000 mg IV 1/1h" e "x / abc / quando apetecer" eram aceites
// sem aviso. A dose e a frequência continuam a ser texto (não se parte o modelo de dados nem a
// app móvel), mas passam a ter de ser interpretáveis, e a dose é comparada com máximos de
// adulto para os fármacos mais prescritos em enfermaria. É uma rede de segurança contra erros
// grosseiros (10×–100×), NÃO um substituto de uma base de dados de medicamentos validada (ver
// PROD-05): acima do máximo, a prescrição exige justificação clínica (override registado).

import { expandirMarcas } from './marcas-dci';
import { normalizarTermo } from './alergias.helper';
import { parsearFrequenciaHoras } from './posologia';

export interface DoseInterpretada {
  valor: number;
  unidade: string;
  /** Valor em mg, quando a unidade é de massa (mg, g, mcg). */
  mg: number | null;
}

const UNIDADES: Record<string, { canon: string; paraMg?: number }> = {
  mg: { canon: 'mg', paraMg: 1 }, g: { canon: 'g', paraMg: 1000 }, gr: { canon: 'g', paraMg: 1000 },
  mcg: { canon: 'mcg', paraMg: 0.001 }, ug: { canon: 'mcg', paraMg: 0.001 }, 'µg': { canon: 'mcg', paraMg: 0.001 },
  ui: { canon: 'UI' }, u: { canon: 'UI' }, iu: { canon: 'UI' }, ml: { canon: 'ml' }, meq: { canon: 'mEq' },
  mmol: { canon: 'mmol' }, comp: { canon: 'comp' }, cp: { canon: 'comp' }, comprimido: { canon: 'comp' },
  comprimidos: { canon: 'comp' }, caps: { canon: 'cáps' }, capsula: { canon: 'cáps' }, gotas: { canon: 'gotas' },
  gts: { canon: 'gotas' }, puff: { canon: 'puff' }, puffs: { canon: 'puff' }, inal: { canon: 'inalação' },
  saqueta: { canon: 'saqueta' }, amp: { canon: 'ampola' }, ampola: { canon: 'ampola' }, un: { canon: 'un' },
  aplicacao: { canon: 'aplicação' }, gota: { canon: 'gotas' },
};

/**
 * "1 g", "500mg", "2,5 mg", "875/125 mg" (usa o primeiro valor), "10 UI", "1 comp".
 * Devolve `null` se não houver um número seguido de uma unidade conhecida.
 */
export function parsearDose(dose: string | null | undefined): DoseInterpretada | null {
  const t = (dose ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*([a-zµ]+)/);
  if (!m) return null;
  const valor = Number(m[1].replace(',', '.'));
  const u = UNIDADES[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '')];
  if (!u || !(valor > 0)) return null;
  return { valor, unidade: u.canon, mg: u.paraMg ? valor * u.paraMg : null };
}

/** Frequência aceitável: com horário (Nx/dia, N/Nh…), SOS ou perfusão contínua. */
export function frequenciaValida(frequencia: string | null | undefined): boolean {
  const f = (frequencia ?? '').trim();
  if (!f) return false;
  if (parsearFrequenciaHoras(f) !== null) return true;
  return /^(sos|em\s+sos|se\s+necess|s\.o\.s|cont[ií]nu|perfus|dose\s+[uú]nica|toma\s+[uú]nica|stat)/i.test(f);
}

export const eSOS = (frequencia: string | null | undefined) => /^(sos|em\s+sos|se\s+necess|s\.o\.s)/i.test((frequencia ?? '').trim());

/** Máximos de ADULTO (mg) por substância: por toma e por 24 h. */
const MAXIMOS: Record<string, { toma: number; dia: number | null }> = {
  paracetamol: { toma: 1000, dia: 4000 },
  ibuprofeno: { toma: 800, dia: 3200 },
  diclofenac: { toma: 75, dia: 150 },
  cetorolaco: { toma: 30, dia: 90 },
  metamizol: { toma: 2000, dia: 6000 },
  acetilsalicilico: { toma: 1000, dia: 4000 },
  naproxeno: { toma: 500, dia: 1500 },
  tramadol: { toma: 100, dia: 400 },
  morfina: { toma: 30, dia: null },
  oxicodona: { toma: 40, dia: null },
  metoclopramida: { toma: 10, dia: 30 },
  ondansetron: { toma: 16, dia: 32 },
  amoxicilina: { toma: 2000, dia: 12000 },
  flucloxacilina: { toma: 2000, dia: 12000 },
  cefuroxima: { toma: 1500, dia: 6000 },
  ceftriaxona: { toma: 4000, dia: 4000 },
  cefazolina: { toma: 2000, dia: 12000 },
  azitromicina: { toma: 500, dia: 500 },
  claritromicina: { toma: 500, dia: 1000 },
  ciprofloxacina: { toma: 750, dia: 1500 },
  levofloxacina: { toma: 750, dia: 750 },
  metronidazol: { toma: 500, dia: 1500 },
  vancomicina: { toma: 2000, dia: 4000 },
  gentamicina: { toma: 560, dia: 560 },
  omeprazol: { toma: 80, dia: 160 },
  pantoprazol: { toma: 80, dia: 240 },
  furosemida: { toma: 250, dia: 1500 },
  diazepam: { toma: 20, dia: 60 },
  lorazepam: { toma: 4, dia: 10 },
  midazolam: { toma: 10, dia: null },
  haloperidol: { toma: 10, dia: 20 },
  enoxaparina: { toma: 200, dia: 400 },
  digoxina: { toma: 0.5, dia: 0.5 },
  varfarina: { toma: 15, dia: 15 },
  amiodarona: { toma: 1200, dia: 2000 },
  metformina: { toma: 1000, dia: 3000 },
  alopurinol: { toma: 900, dia: 900 },
  prednisolona: { toma: 100, dia: 100 },
  metilprednisolona: { toma: 1000, dia: 1000 },
  dexametasona: { toma: 40, dia: 40 },
  enalapril: { toma: 40, dia: 40 },
  ramipril: { toma: 10, dia: 10 },
  bisoprolol: { toma: 10, dia: 20 },
  amlodipina: { toma: 10, dia: 10 },
  sinvastatina: { toma: 80, dia: 80 },
  atorvastatina: { toma: 80, dia: 80 },
};

function substancia(nome: string): string | null {
  const tokens = normalizarTermo(expandirMarcas(nome)).split(' ');
  return tokens.find((t) => MAXIMOS[t]) ?? null;
}

export interface ProblemaDose {
  /** Mensagem para quem prescreve. */
  motivo: string;
}

/**
 * Compara a dose com os máximos de adulto. `tomasDia` = tomas por 24 h (das horas da frequência,
 * ou `maxDosesDia` em SOS). Devolve o problema encontrado, ou `null`.
 */
export function verificarDoseMaxima(nome: string, dose: DoseInterpretada, tomasDia: number | null): ProblemaDose | null {
  if (dose.mg === null) return null; // UI, ml, comprimidos… sem conversão segura para mg
  const s = substancia(nome);
  if (!s) return null;
  const max = MAXIMOS[s];
  const fmt = (mg: number) => (mg >= 1000 ? `${mg / 1000} g` : `${mg} mg`);
  if (dose.mg > max.toma) {
    return { motivo: `${fmt(dose.mg)} por toma excede o máximo de adulto de ${s} (${fmt(max.toma)})` };
  }
  if (max.dia !== null && tomasDia !== null && dose.mg * tomasDia > max.dia) {
    return { motivo: `${fmt(dose.mg * tomasDia)}/24 h excede o máximo diário de ${s} (${fmt(max.dia)})` };
  }
  return null;
}

/** Tomas por 24 h implicadas por uma frequência com horário (null em SOS/contínua). */
export function tomasPorDia(frequencia: string): number | null {
  const h = parsearFrequenciaHoras(frequencia);
  return h ? Math.round(24 / h) : null;
}
