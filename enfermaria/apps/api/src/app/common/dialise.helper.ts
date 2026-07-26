// Cálculos de hemodiálise. Apoio à decisão — validar contra a avaliação do nefrologista.

/** Ganho de peso interdialítico (kg) = peso pré-sessão − peso pós-sessão anterior. */
export function ganhoInterdialitico(pesoPreKg: number, pesoPosAnteriorKg: number): number {
  return Math.round((pesoPreKg - pesoPosAnteriorKg) * 100) / 100;
}

/** Ultrafiltração objetivo (mL) para atingir o peso seco = (pré − seco) × 1000. */
export function ufObjetivoMl(pesoPreKg: number, pesoSecoKg: number): number {
  return Math.max(0, Math.round((pesoPreKg - pesoSecoKg) * 1000));
}

/** Ganho interdialítico excessivo: > 2.5 kg absoluto, ou > 4% do peso seco. */
export function ganhoExcessivo(ganhoKg: number, pesoSecoKg?: number | null): boolean {
  if (ganhoKg > 2.5) return true;
  if (pesoSecoKg && pesoSecoKg > 0 && ganhoKg / pesoSecoKg > 0.04) return true;
  return false;
}
