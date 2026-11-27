// NEWS2 — National Early Warning Score 2 (Royal College of Physicians, 2017).
//
// Duas regras do RCP que este helper torna explícitas (antes estavam em falta):
//
//  1. **"3 num parâmetro isolado"** — um único parâmetro pontuado a 3 exige revisão urgente
//     por um clínico, INDEPENDENTEMENTE do total. Uma FR de 30 dá NEWS2 3 no total mas é um
//     parâmetro vermelho — não pode passar em silêncio.
//  2. **Dados parciais não são dados normais** — pontuar 0 num parâmetro que não foi medido
//     produz um score falsamente tranquilizador. O detalhe abaixo distingue "não medido" de
//     "normal" e diz se o score é *conclusivo* (isto é, se os parâmetros em falta poderiam,
//     no pior caso, levar o doente a território de escalada).
//
// As faixas de pontuação seguem o RCP e NÃO devem ser alteradas sem revisão clínica.

export interface News2Params {
  frequenciaRespiratoria?: number | null;
  saturacaoO2?: number | null;
  o2Suplementar?: boolean | null;
  temperatura?: number | null;
  pressaoSistolica?: number | null;
  pulso?: number | null;
  avpu?: string | null;
}

export type News2Parametro =
  | 'frequenciaRespiratoria'
  | 'saturacaoO2'
  | 'o2Suplementar'
  | 'temperatura'
  | 'pressaoSistolica'
  | 'pulso'
  | 'avpu';

/** Os 7 parâmetros do NEWS2 e a pontuação máxima que cada um pode contribuir. */
const MAX_POR_PARAMETRO: Record<News2Parametro, number> = {
  frequenciaRespiratoria: 3,
  saturacaoO2: 3,
  o2Suplementar: 2,
  temperatura: 3,
  pressaoSistolica: 3,
  pulso: 3,
  avpu: 3,
};

/**
 * Pontuação máxima assumida para um parâmetro **não registado**, ao avaliar se um score
 * baixo é de confiança. Difere de `MAX_POR_PARAMETRO` num ponto: a ausência de registo de
 * O₂ suplementar lê-se como ar ambiente (é a convenção da folha NEWS2 do RCP, onde a coluna
 * "Air/Oxygen" em branco significa ar), logo não introduz incerteza. Os restantes, sim.
 */
const MAX_SE_NAO_REGISTADO: Record<News2Parametro, number> = {
  ...MAX_POR_PARAMETRO,
  o2Suplementar: 0,
};

export const NEWS2_PARAMETROS = Object.keys(MAX_POR_PARAMETRO) as News2Parametro[];

/** Nomes legíveis (para mensagens de alerta). */
export const NEWS2_LABELS: Record<News2Parametro, string> = {
  frequenciaRespiratoria: 'Frequência respiratória',
  saturacaoO2: 'SpO₂',
  o2Suplementar: 'O₂ suplementar',
  temperatura: 'Temperatura',
  pressaoSistolica: 'TA sistólica',
  pulso: 'Pulso',
  avpu: 'Estado de consciência (AVPU)',
};

/** Limiar a partir do qual o NEWS2 obriga a resposta urgente (RCP: 5). */
export const NEWS2_LIMIAR_ESCALADA = 5;
/** Limiar de resposta imediata / equipa de emergência (RCP: 7). */
export const NEWS2_LIMIAR_CRITICO = 7;
/** Mínimo de vitais numéricos para sequer calcular um score. */
const MIN_VITAIS_NUMERICOS = 3;

export interface News2Detalhe {
  /** Score total, ou null se houver menos de 3 vitais numéricos. */
  score: number | null;
  /** Pontuação por parâmetro medido. */
  subscores: Partial<Record<News2Parametro, number>>;
  parametrosPresentes: News2Parametro[];
  parametrosEmFalta: News2Parametro[];
  /** true quando os 7 parâmetros do NEWS2 estavam presentes. */
  completo: boolean;
  /** RCP: existe pelo menos um parâmetro isolado pontuado a 3. */
  parametroIsoladoTres: boolean;
  /** Parâmetros que pontuaram 3 ("vermelhos"). */
  parametrosVermelhos: News2Parametro[];
  /**
   * Score máximo que o doente poderia ter se os parâmetros em falta estivessem
   * todos no pior valor possível. É este o número que diz se um score baixo é
   * de confiança ou apenas o reflexo de dados que faltam.
   */
  scoreMaximoPossivel: number | null;
  /**
   * true quando o score pode ser lido como tranquilizador: ou está completo, ou
   * mesmo no pior cenário os parâmetros em falta não atingiriam o limiar de escalada.
   */
  conclusivo: boolean;
}

function pontuarFR(fr: number): number {
  if (fr <= 8) return 3;
  if (fr <= 11) return 1;
  if (fr <= 20) return 0;
  if (fr <= 24) return 2;
  return 3;
}

function pontuarSpO2(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function pontuarTemperatura(t: number): number {
  if (t <= 35.0) return 3;
  if (t <= 36.0) return 1;
  if (t <= 38.0) return 0;
  if (t <= 39.0) return 1;
  return 2;
}

function pontuarPAS(ps: number): number {
  if (ps <= 90) return 3;
  if (ps <= 100) return 2;
  if (ps <= 110) return 1;
  if (ps <= 219) return 0;
  return 3;
}

function pontuarPulso(fc: number): number {
  if (fc <= 40) return 3;
  if (fc <= 50) return 1;
  if (fc <= 90) return 0;
  if (fc <= 110) return 1;
  if (fc <= 130) return 2;
  return 3;
}

/**
 * Calcula o NEWS2 com o detalhe necessário para decidir escalada: subscores por parâmetro,
 * o que faltou medir, se há um parâmetro isolado a 3 e se o score é conclusivo.
 */
export function calcularNEWS2Detalhado(params: News2Params): News2Detalhe {
  const subscores: Partial<Record<News2Parametro, number>> = {};
  const presentes: News2Parametro[] = [];

  if (params.frequenciaRespiratoria != null) {
    presentes.push('frequenciaRespiratoria');
    subscores.frequenciaRespiratoria = pontuarFR(params.frequenciaRespiratoria);
  }
  if (params.saturacaoO2 != null) {
    presentes.push('saturacaoO2');
    subscores.saturacaoO2 = pontuarSpO2(params.saturacaoO2);
  }
  // O2 suplementar é um parâmetro independente do NEWS2: `false` é uma medição
  // (doente em ar ambiente), `null`/`undefined` é "não registado".
  if (params.o2Suplementar != null) {
    presentes.push('o2Suplementar');
    subscores.o2Suplementar = params.o2Suplementar ? 2 : 0;
  }
  if (params.temperatura != null) {
    presentes.push('temperatura');
    subscores.temperatura = pontuarTemperatura(params.temperatura);
  }
  if (params.pressaoSistolica != null) {
    presentes.push('pressaoSistolica');
    subscores.pressaoSistolica = pontuarPAS(params.pressaoSistolica);
  }
  if (params.pulso != null) {
    presentes.push('pulso');
    subscores.pulso = pontuarPulso(params.pulso);
  }
  if (params.avpu != null && params.avpu !== '') {
    presentes.push('avpu');
    subscores.avpu = params.avpu !== 'A' ? 3 : 0;
  }

  const emFalta = NEWS2_PARAMETROS.filter((p) => !presentes.includes(p));

  // Mantém-se a regra anterior: menos de 3 vitais numéricos → não há score de todo.
  const numericosPresentes = presentes.filter((p) => p !== 'o2Suplementar' && p !== 'avpu');
  if (numericosPresentes.length < MIN_VITAIS_NUMERICOS) {
    return {
      score: null,
      subscores,
      parametrosPresentes: presentes,
      parametrosEmFalta: emFalta,
      completo: false,
      parametroIsoladoTres: Object.values(subscores).some((v) => v === 3),
      parametrosVermelhos: (Object.keys(subscores) as News2Parametro[]).filter((k) => subscores[k] === 3),
      scoreMaximoPossivel: null,
      conclusivo: false,
    };
  }

  const score = Object.values(subscores).reduce((a: number, b) => a + (b ?? 0), 0);
  const vermelhos = (Object.keys(subscores) as News2Parametro[]).filter((k) => subscores[k] === 3);
  const scoreMaximoPossivel = emFalta.reduce((acc, p) => acc + MAX_SE_NAO_REGISTADO[p], score);
  const completo = emFalta.length === 0;

  return {
    score,
    subscores,
    parametrosPresentes: presentes,
    parametrosEmFalta: emFalta,
    completo,
    parametroIsoladoTres: vermelhos.length > 0,
    parametrosVermelhos: vermelhos,
    scoreMaximoPossivel,
    // Um score baixo só é de confiança se, mesmo no pior cenário para o que falta,
    // o doente não atingisse o limiar de escalada.
    conclusivo: completo || score >= NEWS2_LIMIAR_ESCALADA || scoreMaximoPossivel < NEWS2_LIMIAR_ESCALADA,
  };
}

/**
 * Score NEWS2 simples (compatibilidade com os chamadores existentes).
 * Devolve `null` quando há menos de 3 vitais numéricos.
 *
 * ATENÇÃO: um número isolado não diz se foi calculado sobre dados completos.
 * Para decisões de escalada usar `calcularNEWS2Detalhado`.
 */
export function calcularNEWS2(params: News2Params): number | null {
  return calcularNEWS2Detalhado(params).score;
}
