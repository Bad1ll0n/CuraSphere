// Dose pediátrica por peso corporal. A maioria dos fármacos pediátricos doseia-se em mg/kg, com um
// TETO (a dose de adulto) que nunca deve ser ultrapassado. Apoio à decisão — verificar sempre
// contra o formulário/protocolo e a função renal/hepática.

export interface DosePediatricaParams {
  mgPorKg: number; // dose por kg de peso
  pesoKg: number; // peso do doente
  doseMaximaMg?: number | null; // teto (dose de adulto), se aplicável
  frequenciaDia?: number | null; // tomas por dia (para a dose diária total)
}

export interface DosePediatricaResultado {
  doseMg: number; // dose por toma
  limitadaPorMaximo: boolean; // true se o teto de adulto foi aplicado
  doseDiariaMg: number | null; // dose diária total (se frequenciaDia fornecida)
  aviso: string | null;
}

/** Calcula a dose por toma (mg) = mgPorKg × peso, limitada ao máximo, e a dose diária total. */
export function calcularDosePediatrica(p: DosePediatricaParams): DosePediatricaResultado {
  if (!(p.pesoKg > 0) || !(p.mgPorKg > 0)) {
    return { doseMg: 0, limitadaPorMaximo: false, doseDiariaMg: null, aviso: 'Peso e dose/kg têm de ser positivos.' };
  }
  let doseMg = p.mgPorKg * p.pesoKg;
  let limitada = false;
  if (p.doseMaximaMg != null && p.doseMaximaMg > 0 && doseMg > p.doseMaximaMg) {
    doseMg = p.doseMaximaMg;
    limitada = true;
  }
  doseMg = Math.round(doseMg * 100) / 100;
  const doseDiariaMg =
    p.frequenciaDia != null && p.frequenciaDia > 0 ? Math.round(doseMg * p.frequenciaDia * 100) / 100 : null;
  return {
    doseMg,
    limitadaPorMaximo: limitada,
    doseDiariaMg,
    aviso: limitada ? 'Dose limitada ao máximo (dose de adulto) — reavaliar a prescrição.' : null,
  };
}
