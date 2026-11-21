/**
 * QA-16 — coerência de um registo de sinais vitais, a mesma na API, na web e no mobile.
 *
 * Antes, a API aceitava `{}` (um registo vazio que passava a ser "o último" e escondia o anterior)
 * e combinações impossíveis — PAS 40 com PAD 200, pulso 0, FR 0 — que geravam alarmes falsos
 * (NEWS2 11) e corrompiam a tendência.
 *
 *  - Pelo menos um parâmetro medido (notas e O2 suplementar sozinhos não são uma medição).
 *  - A diastólica tem de ser inferior à sistólica.
 *  - Valores incompatíveis com a vida ou extremos (pulso < 20, FR < 4, PAS < 50, SpO2 < 50,
 *    T < 32 °C) só com confirmação explícita (`confirmarValorCritico`): ou é um erro de
 *    digitação/sensor, ou é uma emergência — e nesse caso o NEWS2 dispara o alerta.
 *
 * A app móvel avalia antes de pôr o registo na fila offline: um 4xx na sincronização perdia-o.
 */
export interface VitaisParaCoerencia {
  pressaoSistolica?: number | null;
  pressaoDiastolica?: number | null;
  pulso?: number | null;
  temperatura?: number | null;
  saturacaoO2?: number | null;
  frequenciaRespiratoria?: number | null;
  peso?: number | null;
  avpu?: string | null;
  glasgow?: number | null;
  pamMedia?: number | null;
  dor?: number | null;
  /** Não são medições: sozinhos não fazem um registo. */
  notas?: string | null;
  o2Suplementar?: boolean | null;
}

export const PARAMETROS_MEDIDOS: (keyof VitaisParaCoerencia)[] = [
  'pressaoSistolica', 'pressaoDiastolica', 'pulso', 'temperatura', 'saturacaoO2',
  'frequenciaRespiratoria', 'peso', 'avpu', 'glasgow', 'pamMedia', 'dor',
];

const presente = (v: unknown) => v !== undefined && v !== null && v !== '';

export interface CoerenciaVitais {
  /** Erro que impede o registo (vazio, PAD ≥ PAS). */
  erro: string | null;
  /** Valores críticos que exigem confirmação explícita. */
  criticos: string[];
}

export function avaliarCoerenciaVitais(v: VitaisParaCoerencia): CoerenciaVitais {
  if (!PARAMETROS_MEDIDOS.some((k) => presente(v[k]))) {
    return { erro: 'Registo vazio: indique pelo menos um sinal vital.', criticos: [] };
  }
  if (presente(v.pressaoSistolica) && presente(v.pressaoDiastolica) && Number(v.pressaoDiastolica) >= Number(v.pressaoSistolica)) {
    return { erro: `Tensão arterial incoerente: a diastólica (${v.pressaoDiastolica}) tem de ser inferior à sistólica (${v.pressaoSistolica}).`, criticos: [] };
  }
  const criticos: string[] = [];
  if (presente(v.pulso) && Number(v.pulso) < 20) criticos.push(`pulso ${v.pulso}/min`);
  if (presente(v.frequenciaRespiratoria) && Number(v.frequenciaRespiratoria) < 4) criticos.push(`FR ${v.frequenciaRespiratoria}/min`);
  if (presente(v.pressaoSistolica) && Number(v.pressaoSistolica) < 50) criticos.push(`PAS ${v.pressaoSistolica} mmHg`);
  if (presente(v.saturacaoO2) && Number(v.saturacaoO2) < 50) criticos.push(`SpO2 ${v.saturacaoO2}%`);
  if (presente(v.temperatura) && Number(v.temperatura) < 32) criticos.push(`temperatura ${v.temperatura} °C`);
  return { erro: null, criticos };
}
