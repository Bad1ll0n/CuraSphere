// PEWS — Pediatric Early Warning Score. Análogo ao NEWS2 (ver news2.helper.ts), MAS os intervalos
// normais dependem da IDADE (a fisiologia pediátrica varia muito com a idade). Apoio à decisão
// clínica — os limiares exatos devem ser validados contra o protocolo PEWS da instituição.

export interface PewsParams {
  frequenciaRespiratoria?: number | null;
  saturacaoO2?: number | null;
  pulso?: number | null;
  temperatura?: number | null;
  avpu?: string | null; // A|V|P|U (Alert/Voice/Pain/Unresponsive)
  esforcoRespiratorio?: 'normal' | 'aumentado' | 'grave' | null;
}

// Idade máxima (exclusiva) a que se aplica o PEWS — a partir daqui usa-se o NEWS2.
export const PEWS_IDADE_MAX_MESES = 192; // 16 anos

interface Banda {
  rr: [number, number]; // intervalo respiratório normal
  hr: [number, number]; // intervalo de frequência cardíaca normal
}

// Faixas etárias e intervalos NORMAIS aproximados (validar contra o protocolo do hospital).
function bandaEtaria(idadeMeses: number): Banda {
  if (idadeMeses < 12) return { rr: [30, 60], hr: [100, 160] }; // lactente (0–11 meses)
  if (idadeMeses < 60) return { rr: [24, 40], hr: [90, 150] }; //  1–4 anos
  if (idadeMeses < 144) return { rr: [18, 30], hr: [70, 120] }; //  5–11 anos
  return { rr: [12, 20], hr: [60, 100] }; //                       12–15 anos
}

// Pontua um valor face ao intervalo normal [min,max]: 0 dentro; 1/2/3 conforme a magnitude do desvio.
function pontuarIntervalo(v: number, [min, max]: [number, number]): number {
  if (v >= min && v <= max) return 0;
  const desvio = Math.max(min - v, v - max); // distância ao intervalo (sempre > 0 aqui)
  const amplitude = max - min;
  if (desvio <= amplitude * 0.15) return 1;
  if (desvio <= amplitude * 0.4) return 2;
  return 3;
}

/**
 * Calcula o PEWS a partir dos sinais vitais e da idade (em meses). Devolve `null` se houver menos
 * de 3 vitais ou se a idade estiver fora do âmbito pediátrico (≥16 anos → usar NEWS2).
 */
export function calcularPEWS(params: PewsParams, idadeMeses: number): number | null {
  const valores = [params.frequenciaRespiratoria, params.saturacaoO2, params.pulso, params.temperatura];
  if (valores.filter((p) => p != null).length < 3) return null;
  if (idadeMeses < 0 || idadeMeses >= PEWS_IDADE_MAX_MESES) return null;

  const banda = bandaEtaria(idadeMeses);
  let score = 0;

  if (params.frequenciaRespiratoria != null) score += pontuarIntervalo(params.frequenciaRespiratoria, banda.rr);
  if (params.pulso != null) score += pontuarIntervalo(params.pulso, banda.hr);

  if (params.saturacaoO2 != null) {
    const s = params.saturacaoO2;
    if (s < 90) score += 3;
    else if (s < 94) score += 2;
    else if (s < 96) score += 1;
  }

  if (params.temperatura != null) {
    const t = params.temperatura;
    if (t < 35 || t >= 39.5) score += 2;
    else if (t < 36 || t >= 38.5) score += 1;
  }

  if (params.esforcoRespiratorio === 'grave') score += 3;
  else if (params.esforcoRespiratorio === 'aumentado') score += 1;

  if (params.avpu && params.avpu !== 'A') score += 3;

  return score;
}

/** Idade em meses a partir da data de nascimento. */
export function idadeEmMeses(dataNascimento: Date | string, referencia: Date = new Date()): number {
  const nasc = new Date(dataNascimento);
  return Math.max(0, (referencia.getFullYear() - nasc.getFullYear()) * 12 + (referencia.getMonth() - nasc.getMonth()));
}
