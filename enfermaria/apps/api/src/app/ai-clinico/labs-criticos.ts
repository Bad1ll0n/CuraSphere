/**
 * Análises laboratoriais críticas das últimas 48 h de um doente — usadas pelo vigilante de
 * deterioração (watchdog). Regra pura, separada do serviço de IA (ARQ-06/ARQ-23): o serviço lê as
 * análises de todos os doentes numa só consulta e aplica isto a cada um.
 *
 * `labs` vem do mais recente para o mais antigo (para a progressão da creatinina).
 */
export interface Analise { parametro?: string | null; valor?: unknown }

export function alertasDeLabs(labs: Analise[]): string[] {
  const alertas: string[] = [];
  const valoresPorParametro: Record<string, number[]> = {};

  for (const lab of labs) {
    const p = (lab.parametro ?? '').toLowerCase();
    const v = typeof lab.valor === 'number' ? lab.valor : parseFloat(String(lab.valor ?? ''));
    if (isNaN(v)) continue;

    (valoresPorParametro[p] ??= []).push(v);

    if (p.includes('troponina') && v > 0.04) alertas.push(`Troponina elevada: ${v} µg/L`);
    if (p.includes('lactato') && v > 2.0) alertas.push(`Lactato elevado: ${v} mmol/L`);
    if ((p === 'hb' || p === 'hemoglobina' || p.includes('hemoglobin')) && v < 7.0) alertas.push(`Hemoglobina crítica: ${v} g/dL`);
    if ((p.includes('leucocit') || p === 'wbc') && (v > 12.0 || v < 4.0)) alertas.push(`Leucócitos anómalos: ${v} ×10⁹/L`);
  }

  // AKI: progressão da creatinina > 0,3 mg/dL nas últimas 48 h
  for (const key of Object.keys(valoresPorParametro).filter((k) => k.includes('creatinin'))) {
    const vals = valoresPorParametro[key]; // mais recente primeiro
    if (vals.length >= 2 && vals[0] - vals[vals.length - 1] > 0.3) {
      alertas.push(`Progressão creatinina: ${vals[vals.length - 1]} → ${vals[0]} mg/dL (AKI suspeito)`);
    }
  }

  return [...new Set(alertas)];
}
