// Cálculos de quimioterapia. Apoio à decisão — validar contra o protocolo e a prescrição.

/** Superfície corporal (m²) pela fórmula de Mosteller: √(altura_cm × peso_kg / 3600). */
export function superficieCorporal(pesoKg: number, alturaCm: number): number {
  if (!(pesoKg > 0) || !(alturaCm > 0)) return 0;
  return Math.round(Math.sqrt((alturaCm * pesoKg) / 3600) * 100) / 100;
}

/** Dose de citostático = mg/m² × BSA, opcionalmente limitada a uma dose máxima. */
export function doseQuimio(
  mgPorM2: number,
  bsaM2: number,
  doseMaximaMg?: number | null,
): { doseMg: number; limitada: boolean } {
  const bruta = mgPorM2 * bsaM2;
  const limitada = doseMaximaMg != null && bruta > doseMaximaMg;
  const doseMg = limitada ? doseMaximaMg! : bruta;
  return { doseMg: Math.round(doseMg * 10) / 10, limitada };
}

/** Toxicidade CTCAE grau ≥ 3 é acionável (alerta + reavaliar dose/protocolo). */
export function toxicidadeAcionavel(grau: number | null | undefined): boolean {
  return grau != null && grau >= 3;
}
