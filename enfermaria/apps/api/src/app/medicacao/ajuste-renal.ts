import { normalizarTermo } from './alergias.helper';
import { expandirMarcas } from './marcas-dci';

/**
 * PROD-05 — ajuste de dose na insuficiência renal, DETERMINÍSTICO e com fonte.
 * Antes, a dose recomendada era pedida a um LLM, sem fonte nem referência.
 *
 * Esta tabela cobre fármacos de eliminação renal frequentes no internamento e diz o que o RCM
 * determina para cada faixa de TFG. É orientação: o RCM do medicamento dispensado e o
 * farmacêutico clínico prevalecem. Uma instituição pode alargá-la.
 */
export interface RegraRenal { tfgAbaixoDe: number; texto: string }
export interface FarmacoRenal { termos: string[]; regras: RegraRenal[]; fonte: string }

const RCM = 'RCM (EMA/INFARMED) — confirmar no RCM do medicamento dispensado';

export const AJUSTE_RENAL: FarmacoRenal[] = [
  { termos: ['metformina'], fonte: RCM, regras: [
    { tfgAbaixoDe: 30, texto: 'Contraindicada com TFG < 30.' },
    { tfgAbaixoDe: 45, texto: 'TFG 30–44: não iniciar; se já em curso, dose máxima 1000 mg/dia e reavaliar.' },
    { tfgAbaixoDe: 60, texto: 'TFG 45–59: dose máxima 2000 mg/dia; vigiar a função renal.' },
  ] },
  { termos: ['enoxaparina'], fonte: RCM, regras: [
    { tfgAbaixoDe: 15, texto: 'TFG < 15: não recomendada (sem dados).' },
    { tfgAbaixoDe: 30, texto: 'TFG 15–29: profilaxia 2000 UI (20 mg) 1x/dia; tratamento 100 UI/kg 1x/dia.' },
  ] },
  { termos: ['dabigatrano'], fonte: RCM, regras: [{ tfgAbaixoDe: 30, texto: 'Contraindicado com TFG < 30.' }] },
  { termos: ['rivaroxabano', 'apixabano', 'edoxabano'], fonte: RCM, regras: [
    { tfgAbaixoDe: 15, texto: 'TFG < 15: não recomendado.' },
    { tfgAbaixoDe: 50, texto: 'TFG 15–49: pode exigir redução de dose conforme a indicação — ver RCM.' },
  ] },
  { termos: ['gentamicina', 'amicacina', 'tobramicina', 'vancomicina'], fonte: `${RCM}; doseamento sérico (TDM)`, regras: [
    { tfgAbaixoDe: 60, texto: 'Ajustar o intervalo pela função renal e por níveis séricos (TDM); nefrotóxico.' },
  ] },
  { termos: ['aciclovir'], fonte: RCM, regras: [
    { tfgAbaixoDe: 10, texto: 'TFG < 10: dose reduzida a 50% de 24/24h (IV).' },
    { tfgAbaixoDe: 25, texto: 'TFG 10–24: dose habitual de 24/24h (IV).' },
    { tfgAbaixoDe: 50, texto: 'TFG 25–49: dose habitual de 12/12h (IV).' },
  ] },
  { termos: ['gabapentina'], fonte: RCM, regras: [
    { tfgAbaixoDe: 15, texto: 'TFG < 15: 100–300 mg/dia.' },
    { tfgAbaixoDe: 30, texto: 'TFG 15–29: 200–700 mg/dia.' },
    { tfgAbaixoDe: 60, texto: 'TFG 30–59: 400–1400 mg/dia.' },
  ] },
  { termos: ['nitrofurantoina'], fonte: RCM, regras: [{ tfgAbaixoDe: 45, texto: 'Evitar com TFG < 45 (ineficaz e tóxica).' }] },
  { termos: ['espironolactona'], fonte: RCM, regras: [{ tfgAbaixoDe: 30, texto: 'Evitar com TFG < 30 (risco de hipercaliemia).' }] },
  { termos: ['tramadol'], fonte: RCM, regras: [{ tfgAbaixoDe: 30, texto: 'TFG < 30: intervalo de 12/12h, máximo 200 mg/dia.' }] },
  { termos: ['morfina'], fonte: RCM, regras: [{ tfgAbaixoDe: 30, texto: 'TFG < 30: reduzir dose e frequência (metabolitos activos acumulam); preferir alternativa.' }] },
  { termos: ['digoxina'], fonte: RCM, regras: [{ tfgAbaixoDe: 60, texto: 'Reduzir a dose de manutenção e vigiar digoxinemia.' }] },
  { termos: ['levofloxacina', 'ciprofloxacina'], fonte: RCM, regras: [{ tfgAbaixoDe: 50, texto: 'Reduzir a dose ou alargar o intervalo conforme o RCM.' }] },
];

/** Estádio KDIGO da TFG. */
export function estadioKdigo(tfg: number): string {
  if (tfg >= 90) return 'G1';
  if (tfg >= 60) return 'G2';
  if (tfg >= 45) return 'G3a';
  if (tfg >= 30) return 'G3b';
  if (tfg >= 15) return 'G4';
  return 'G5';
}

/** A orientação aplicável a este medicamento com esta TFG (ou `null` se nada muda). */
export function ajusteRenal(nomeMedicamento: string, tfg: number): { texto: string; fonte: string; farmaco: string } | null {
  const texto = ` ${normalizarTermo(expandirMarcas(nomeMedicamento))}`;
  const f = AJUSTE_RENAL.find((x) => x.termos.some((t) => texto.includes(` ${t}`)));
  if (!f) return null;
  const regra = [...f.regras].sort((a, b) => a.tfgAbaixoDe - b.tfgAbaixoDe).find((r) => tfg < r.tfgAbaixoDe);
  return regra ? { texto: regra.texto, fonte: f.fonte, farmaco: f.termos.find((t) => texto.includes(` ${t}`))! } : null;
}
