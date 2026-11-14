import { normalizarTermo, tokenizar } from '../medicacao/alergias.helper';
import { expandirMarcas } from '../medicacao/marcas-dci';

/**
 * PROD-10 — periodicidade da vigilância. Cada registo fixa, no momento em que é feito, quando
 * volta a ser devido; a lista "em atraso" compara isso com o relógio.
 *
 * NEWS2 (Royal College of Physicians, 2017) — frequência MÍNIMA de monitorização:
 *   0 → 12 h · 1–4 → 4–6 h (usa-se 4) · 3 num só parâmetro ou 5–6 → 1 h · ≥ 7 → contínua (15 min)
 * Braden/Morse: avaliação inicial nas primeiras 24 h e reavaliação periódica (por omissão 48 h e
 * 72 h; a Orientação DGS 017/2011 prevê reavaliação periódica e sempre que a condição muda).
 * Dor após analgesia: 30 min (IV) / 60 min (outras vias) — reavaliação da eficácia.
 *
 * Ajustável por serviço (sem rebuild) com VIGILANCIA_INTERVALOS, por exemplo:
 *   {"UCI": {"news2Zero": 4, "bradenHoras": 24}, "Pediatria": {"morseHoras": 24}}
 */
export interface IntervalosVigilancia {
  news2Zero: number;      // horas
  news2Baixo: number;     // 1–4
  news2Medio: number;     // 5–6 ou 3 num só parâmetro
  news2Alto: number;      // ≥ 7
  news2Incompleto: number; // registo sem os 7 parâmetros: não se pode descansar 12 h
  bradenHoras: number;
  morseHoras: number;
  avaliacaoInicialHoras: number;
  dorIvMinutos: number;
  dorOutrasMinutos: number;
}

export const INTERVALOS_OMISSAO: IntervalosVigilancia = {
  news2Zero: 12,
  news2Baixo: 4,
  news2Medio: 1,
  news2Alto: 0.25,
  news2Incompleto: 4,
  bradenHoras: 48,
  morseHoras: 72,
  avaliacaoInicialHoras: 24,
  dorIvMinutos: 30,
  dorOutrasMinutos: 60,
};

export function intervalosDoServico(servico?: string | null): IntervalosVigilancia {
  let porServico: Record<string, Partial<IntervalosVigilancia>> = {};
  try { porServico = JSON.parse(process.env['VIGILANCIA_INTERVALOS'] ?? '{}'); } catch { /* configuração inválida: omissões */ }
  const ajustes = servico ? porServico[servico] ?? {} : {};
  const r = { ...INTERVALOS_OMISSAO };
  for (const [k, v] of Object.entries(ajustes)) {
    if (k in r && typeof v === 'number' && v > 0) (r as Record<string, number>)[k] = v;
  }
  return r;
}

const H = 3_600_000;

/** Próxima observação de sinais vitais devida, segundo o NEWS2 deste registo. */
export function proximaAvaliacaoSinaisVitais(
  registo: { data: Date; news2: number | null | undefined; news2Completo?: boolean | null; news2ParametroIsolado3?: boolean | null },
  servico?: string | null,
): Date {
  const i = intervalosDoServico(servico);
  const n = registo.news2;
  let horas: number;
  if (n == null) horas = i.news2Incompleto;
  else if (n >= 7) horas = i.news2Alto;
  else if (n >= 5 || registo.news2ParametroIsolado3) horas = i.news2Medio;
  else if (n >= 1) horas = i.news2Baixo;
  else horas = i.news2Zero;
  if (registo.news2Completo === false) horas = Math.min(horas, i.news2Incompleto);
  return new Date(registo.data.getTime() + horas * H);
}

export function proximaAvaliacaoRisco(tipo: 'braden' | 'morse', data: Date, servico?: string | null): Date {
  const i = intervalosDoServico(servico);
  return new Date(data.getTime() + (tipo === 'braden' ? i.bradenHoras : i.morseHoras) * H);
}

/** Substâncias analgésicas (DCI) — uma toma de qualquer uma pede reavaliação da dor. */
const ANALGESICOS = new Set([
  'paracetamol', 'metamizol', 'ibuprofeno', 'cetorolac', 'diclofenac', 'naproxeno', 'cetoprofeno',
  'dexcetoprofeno', 'tramadol', 'tapentadol', 'morfina', 'fentanilo', 'oxicodona', 'hidromorfona',
  'petidina', 'buprenorfina', 'metadona', 'codeina', 'nalbufina', 'parecoxib', 'etoricoxib',
]);

export function eAnalgesico(nomeMedicamento: string): boolean {
  return tokenizar(expandirMarcas(nomeMedicamento)).some((t) => ANALGESICOS.has(normalizarTermo(t)));
}

/** Até quando a dor tem de ser reavaliada depois de um analgésico (null se não for analgésico). */
export function reavaliacaoDorAte(nomeMedicamento: string, via: string | null | undefined, administradoEm: Date, servico?: string | null): Date | null {
  if (!eAnalgesico(nomeMedicamento)) return null;
  const i = intervalosDoServico(servico);
  const iv = /^(iv|ev|intravenos|endovenos)/i.test(normalizarTermo(via ?? ''));
  return new Date(administradoEm.getTime() + (iv ? i.dorIvMinutos : i.dorOutrasMinutos) * 60_000);
}

/** PROD-09: escalas de dor admitidas e respectivos limites (todas 0–10, excepto CPOT 0–8). */
export const ESCALAS_DOR: Record<string, { min: number; max: number; descricao: string }> = {
  numerica: { min: 0, max: 10, descricao: 'Escala numérica (0–10)' },
  eva: { min: 0, max: 10, descricao: 'Escala visual analógica (0–10)' },
  faces: { min: 0, max: 10, descricao: 'Escala de faces (Wong-Baker, 0–10)' },
  painad: { min: 0, max: 10, descricao: 'PAINAD — demência avançada (0–10)' },
  cpot: { min: 0, max: 8, descricao: 'CPOT — doente crítico não comunicante (0–8)' },
  flacc: { min: 0, max: 10, descricao: 'FLACC — criança/não verbal (0–10)' },
};
