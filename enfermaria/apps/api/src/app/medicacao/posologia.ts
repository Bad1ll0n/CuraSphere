// PROD-04 — posologia: intervalo entre tomas e horários planeados.
//
// O parser anterior só reconhecia "N/Nh" (o formato do seed). O formulário de prescrição da
// web oferece "1x/dia" … "8x/dia", "SOS" e "contínua": tudo devolvia `null`, e a timeline do
// turno ignorava a medicação. Nenhuma prescrição feita na web chegava à grelha do enfermeiro.
//
// Os horários deixam também de ser "última administração + intervalo" (uma toma por turno,
// que derivava com cada atraso e usava a hora UTC). Passam a ser horários-padrão fixos, como
// num MAR em papel: âncora às 08:00 e tomas de N em N horas (q6h → 08-14-20-02), na hora
// local do hospital.

import { inicioDoDiaClinico, somarDiasClinicos } from '../common/dia-clinico.helper';

/** Hora da primeira toma do dia nos horários-padrão (hora local do hospital). */
export const HORA_ANCORA = 8;

const ABREVIATURAS: Record<string, number> = {
  id: 24, qd: 24, od: 24, bid: 12, tid: 8, qid: 6,
};

/**
 * Horas entre tomas, ou `null` quando a medicação não tem horário fixo (SOS, perfusão
 * contínua, texto que não se consegue interpretar).
 */
export function parsearFrequenciaHoras(frequencia: string | null | undefined): number | null {
  const f = (frequencia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (!f) return null;
  if (/^(sos|em\s+sos|se\s+necessario|s\.o\.s\.?)/.test(f)) return null;
  if (/^(continu|perfus)/.test(f)) return null;

  // "8/8h", "8 / 8 h"
  let m = f.match(/(\d+)\s*\/\s*(\d+)\s*h/);
  if (m) return valido(parseInt(m[2], 10));
  // "q8h", "cada 8h", "de 8 em 8 horas"
  m = f.match(/(?:^q|cada\s+|de\s+)(\d+)\s*(?:h|horas?|em\s+\d+\s*h)/);
  if (m) return valido(parseInt(m[1], 10));
  // "2x/dia", "2 x dia", "2 vezes ao dia", "2id"
  m = f.match(/^(\d+)\s*(?:x|vezes)\s*(?:\/|ao|por|p\/)?\s*dia/) ?? f.match(/^(\d+)\s*id$/);
  if (m) {
    const n = parseInt(m[1], 10);
    return n > 0 && 24 % n === 0 ? valido(24 / n) : null;
  }
  const abrev = ABREVIATURAS[f.replace(/[^a-z]/g, '')];
  if (abrev) return abrev;
  return null;
}

function valido(h: number): number | null {
  return Number.isFinite(h) && h >= 1 && h <= 24 ? h : null;
}

/** Horas locais (0–23) dos horários-padrão para um intervalo. */
export function horariosPadrao(intervaloHoras: number): number[] {
  const horas = new Set<number>();
  for (let k = 0; k * intervaloHoras < 24; k++) horas.add((HORA_ANCORA + k * intervaloHoras) % 24);
  return [...horas].sort((a, b) => a - b);
}

/**
 * Tomas planeadas no intervalo [inicio, fim): instantes (UTC) nos horários-padrão locais.
 * Não gera tomas antes do início da prescrição.
 */
export function tomasPlaneadas(
  frequencia: string,
  inicio: Date,
  fim: Date,
  iniciadoEm?: Date,
): Date[] {
  const intervalo = parsearFrequenciaHoras(frequencia);
  if (!intervalo) return [];
  const horas = horariosPadrao(intervalo);
  const tomas: Date[] = [];
  let dia = inicioDoDiaClinico(new Date(inicio.getTime() - 86_400_000));
  while (dia < fim) {
    const proximoDia = somarDiasClinicos(dia, 1);
    for (const h of horas) {
      const t = new Date(dia.getTime() + h * 3_600_000);
      if (t >= inicio && t < fim && t < proximoDia && (!iniciadoEm || t >= iniciadoEm)) tomas.push(t);
    }
    dia = proximoDia;
  }
  return tomas.sort((a, b) => a.getTime() - b.getTime());
}

/** Classificação de uma toma planeada. */
export type EstadoToma = 'administrada' | 'em_atraso' | 'devida';

/** Uma administração conta para a toma se acontecer até 1 h antes ou 2 h depois. */
export const JANELA_ANTES_MS = 60 * 60_000;
export const JANELA_DEPOIS_MS = 2 * 60 * 60_000;
/** Passada 1 h da hora planeada sem registo, a toma está em atraso. */
export const ATRASO_MS = 60 * 60_000;

/**
 * Faz corresponder cada toma planeada a, no máximo, uma administração registada (a mais
 * próxima dentro da janela, nunca a mesma duas vezes).
 */
export function classificarTomas(
  tomas: Date[],
  administracoes: Date[],
  agora: Date = new Date(),
): { hora: Date; estado: EstadoToma; administradaEm?: Date }[] {
  const livres = [...administracoes].sort((a, b) => a.getTime() - b.getTime());
  return tomas.map((t) => {
    let melhor = -1;
    for (let i = 0; i < livres.length; i++) {
      const d = livres[i].getTime() - t.getTime();
      if (d < -JANELA_ANTES_MS || d > JANELA_DEPOIS_MS) continue;
      if (melhor < 0 || Math.abs(d) < Math.abs(livres[melhor].getTime() - t.getTime())) melhor = i;
    }
    if (melhor >= 0) {
      const [adm] = livres.splice(melhor, 1);
      return { hora: t, estado: 'administrada' as const, administradaEm: adm };
    }
    return { hora: t, estado: agora.getTime() > t.getTime() + ATRASO_MS ? 'em_atraso' as const : 'devida' as const };
  });
}

/** Hora local (HH:00) de um instante, no fuso do hospital. */
export function horaLocal(instante: Date): string {
  const dia = inicioDoDiaClinico(instante);
  const h = Math.floor((instante.getTime() - dia.getTime()) / 3_600_000);
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:00`;
}
