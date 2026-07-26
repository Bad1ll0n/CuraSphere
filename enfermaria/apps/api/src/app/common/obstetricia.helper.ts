// Cálculos obstétricos. Apoio à decisão — confirmar contra a avaliação clínica/ecográfica.

const DIAS_GESTACAO = 280; // 40 semanas — regra de Naegele (a partir da DUM)

/** Data provável do parto (DPP) = DUM + 280 dias. */
export function calcularDPP(dum: Date | string): Date {
  const d = new Date(dum);
  return new Date(d.getTime() + DIAS_GESTACAO * 86_400_000);
}

/** Idade gestacional (semanas + dias) a partir da DUM. `null` se fora do intervalo plausível. */
export function semanasGestacao(
  dum: Date | string,
  ref: Date = new Date(),
): { semanas: number; dias: number } | null {
  const diffDias = Math.floor((ref.getTime() - new Date(dum).getTime()) / 86_400_000);
  if (diffDias < 0 || diffDias > 320) return null; // ~0 a 45+ semanas
  return { semanas: Math.floor(diffDias / 7), dias: diffDias % 7 };
}

/** Classifica a frequência cardíaca fetal (bpm): <110 bradicardia, >160 taquicardia. */
export function fcFetalAnormal(fc: number): 'bradicardia' | 'taquicardia' | null {
  if (fc < 110) return 'bradicardia';
  if (fc > 160) return 'taquicardia';
  return null;
}
