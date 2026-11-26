/**
 * PROD-22 — cálculos que dependem do sexo e da antropometria do doente.
 */
export type Sexo = 'masculino' | 'feminino' | 'indeterminado';
export const SEXOS: Sexo[] = ['masculino', 'feminino', 'indeterminado'];

/**
 * TFG estimada pela CKD-EPI 2021 (sem raça), em mL/min/1,73 m².
 *   142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1,200 × 0,9938^idade × 1,012 [mulher]
 *   κ = 0,7 (mulher) / 0,9 (homem) · α = −0,241 (mulher) / −0,302 (homem)
 * Antes usava-se sempre a equação masculina ("conservadora"), o que sobrestima a TFG de uma
 * mulher — o lado perigoso para fármacos de eliminação renal. Sem sexo registado devolve-se o
 * valor MAIS BAIXO das duas equações e diz-se porquê.
 */
export function tfgCkdEpi2021(creatininaMgDl: number, idade: number, sexo?: string | null): { tfg: number; nota?: string } {
  const calc = (fem: boolean) => {
    const k = fem ? 0.7 : 0.9;
    const a = fem ? -0.241 : -0.302;
    const r = creatininaMgDl / k;
    return 142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, idade) * (fem ? 1.012 : 1);
  };
  if (sexo === 'feminino') return { tfg: Math.round(calc(true)) };
  if (sexo === 'masculino') return { tfg: Math.round(calc(false)) };
  return {
    tfg: Math.round(Math.min(calc(true), calc(false))),
    nota: 'Sexo do doente não registado — usada a estimativa mais baixa das duas equações.',
  };
}

/** Superfície corporal (Mosteller), m². */
export function superficieCorporal(pesoKg: number, alturaCm: number): number {
  return Math.round(Math.sqrt((pesoKg * alturaCm) / 3600) * 100) / 100;
}
