export interface News2Params {
  frequenciaRespiratoria?: number | null;
  saturacaoO2?: number | null;
  temperatura?: number | null;
  pressaoSistolica?: number | null;
  pulso?: number | null;
  avpu?: string | null;
}

export function calcularNEWS2(params: News2Params): number | null {
  const valores = [
    params.frequenciaRespiratoria,
    params.saturacaoO2,
    params.temperatura,
    params.pressaoSistolica,
    params.pulso,
  ];
  if (valores.filter((p) => p != null).length < 3) return null;

  let score = 0;

  if (params.frequenciaRespiratoria != null) {
    const fr = params.frequenciaRespiratoria;
    if (fr <= 8) score += 3;
    else if (fr <= 11) score += 1;
    else if (fr <= 20) score += 0;
    else if (fr <= 24) score += 2;
    else score += 3;
  }

  if (params.saturacaoO2 != null) {
    const spo2 = params.saturacaoO2;
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
  }

  if (params.temperatura != null) {
    const t = params.temperatura;
    if (t <= 35.0) score += 3;
    else if (t <= 36.0) score += 1;
    else if (t <= 38.0) score += 0;
    else if (t <= 39.0) score += 1;
    else score += 2;
  }

  if (params.pressaoSistolica != null) {
    const ps = params.pressaoSistolica;
    if (ps <= 90) score += 3;
    else if (ps <= 100) score += 2;
    else if (ps <= 110) score += 1;
    else if (ps <= 219) score += 0;
    else score += 3;
  }

  if (params.pulso != null) {
    const fc = params.pulso;
    if (fc <= 40) score += 3;
    else if (fc <= 50) score += 1;
    else if (fc <= 90) score += 0;
    else if (fc <= 110) score += 1;
    else if (fc <= 130) score += 2;
    else score += 3;
  }

  if (params.avpu && params.avpu !== 'A') score += 3;

  return score;
}
