/**
 * PROD-17 — dotação segura e escala, por regras explícitas (sem LLM).
 *
 * O número de enfermeiros deixa de ser pedido a um modelo de linguagem com um rácio fixo de 6
 * doentes por enfermeiro: passa a ser HORAS DE CUIDADOS NECESSÁRIAS (pela dependência de cada
 * doente) contra HORAS DISPONÍVEIS (pelos enfermeiros escalados), por serviço e turno. Cada
 * número tem origem visível — é isso que serve numa negociação de recursos.
 *
 * Os valores por omissão são de referência e TÊM de ser validados pela direção de enfermagem do
 * hospital (Regulamento OE n.º 743/2019, Norma para o cálculo de dotações seguras); são
 * configuráveis por serviço.
 */
export type Categoria = 'I' | 'II' | 'III' | 'IV';
export type Turno = 'manha' | 'tarde' | 'noite';
export const TURNOS: Turno[] = ['manha', 'tarde', 'noite'];
export const HORAS_TURNO = 8;

export interface Parametros {
  horasPorCategoria: Record<Categoria, number>;
  distribuicaoTurno: Record<Turno, number>;
  horasEfetivasTurno: number;
  minimos: Record<Turno, { enfermeiro: number; auxiliar: number; medico: number }>;
  horasSemanaisMax: number;
  competenciaObrigatoria: string | null;
}

export const PARAMETROS_REFERENCIA: Parametros = {
  horasPorCategoria: { I: 2.5, II: 4, III: 6, IV: 9 },
  distribuicaoTurno: { manha: 0.45, tarde: 0.35, noite: 0.2 },
  horasEfetivasTurno: 7,
  minimos: {
    manha: { enfermeiro: 2, auxiliar: 1, medico: 1 },
    tarde: { enfermeiro: 2, auxiliar: 1, medico: 1 },
    noite: { enfermeiro: 2, auxiliar: 1, medico: 1 },
  },
  horasSemanaisMax: 40,
  competenciaObrigatoria: null,
};

export function validarParametros(p: Parametros): string[] {
  const erros: string[] = [];
  const soma = TURNOS.reduce((t, k) => t + (p.distribuicaoTurno[k] ?? 0), 0);
  if (Math.abs(soma - 1) > 0.01) erros.push(`A distribuição pelos turnos tem de somar 1 (soma ${soma.toFixed(2)}).`);
  for (const c of ['I', 'II', 'III', 'IV'] as Categoria[]) {
    const h = p.horasPorCategoria[c];
    if (!(h > 0 && h <= 24)) erros.push(`Horas da categoria ${c} fora de 0–24.`);
  }
  if (!(p.horasEfetivasTurno > 0 && p.horasEfetivasTurno <= HORAS_TURNO)) erros.push(`Horas efetivas por turno fora de 0–${HORAS_TURNO}.`);
  if (!(p.horasSemanaisMax >= HORAS_TURNO && p.horasSemanaisMax <= 60)) erros.push('Horas semanais máximas fora de 8–60.');
  for (const t of TURNOS) for (const [r, n] of Object.entries(p.minimos[t] ?? {})) {
    if (!(Number.isInteger(n) && n >= 0 && n <= 30)) erros.push(`Mínimo de ${r} no turno ${t} inválido.`);
  }
  return erros;
}

/**
 * Categoria de dependência (I mínima … IV total), ao estilo do SCD/E:
 *  - base no Barthel (≥ 91 I, 61–90 II, 21–60 III, ≤ 20 IV); sem Barthel, II;
 *  - sobe um nível com NEWS2 ≥ 5 (vigilância apertada) ou ≥ 12 intervenções de enfermagem/dia.
 */
export function categoriaDependencia(d: { barthel: number | null; news2: number | null; intervencoesDia: number }): Categoria {
  const ordem: Categoria[] = ['I', 'II', 'III', 'IV'];
  let i = d.barthel == null ? 1 : d.barthel >= 91 ? 0 : d.barthel >= 61 ? 1 : d.barthel >= 21 ? 2 : 3;
  if ((d.news2 ?? 0) >= 5 || d.intervencoesDia >= 12) i = Math.min(3, i + 1);
  return ordem[i];
}

export interface ResultadoDotacao {
  doentes: number;
  porCategoria: Record<Categoria, number>;
  horasNecessarias: number;
  horasDisponiveis: number;
  enfermeiros: number;
  enfermeirosNecessarios: number;
  racio: number | null;
  semaforo: 'verde' | 'amarelo' | 'vermelho' | 'sem_doentes';
}

/** Horas necessárias no turno vs disponíveis; semáforo ≥ 1 verde, ≥ 0,85 amarelo, abaixo vermelho. */
export function calcularDotacao(categorias: Categoria[], enfermeiros: number, turno: Turno, p: Parametros): ResultadoDotacao {
  const porCategoria = { I: 0, II: 0, III: 0, IV: 0 } as Record<Categoria, number>;
  for (const c of categorias) porCategoria[c]++;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const necessarias = categorias.reduce((t, c) => t + p.horasPorCategoria[c], 0) * p.distribuicaoTurno[turno];
  const disponiveis = enfermeiros * p.horasEfetivasTurno;
  const minimo = p.minimos[turno]?.enfermeiro ?? 0;
  const enfermeirosNecessarios = Math.max(minimo, Math.ceil(necessarias / p.horasEfetivasTurno - 1e-9));
  const racio = necessarias > 0 ? Math.round((disponiveis / necessarias) * 100) / 100 : null;
  const semaforo = categorias.length === 0 ? 'sem_doentes'
    : enfermeiros < minimo ? 'vermelho'
      : racio! >= 1 ? 'verde' : racio! >= 0.85 ? 'amarelo' : 'vermelho';
  return { doentes: categorias.length, porCategoria, horasNecessarias: r1(necessarias), horasDisponiveis: r1(disponiveis), enfermeiros, enfermeirosNecessarios, racio, semaforo };
}

// ── Escala ────────────────────────────────────────────────────────────────────

export interface Profissional { id: string; role: 'enfermeiro' | 'auxiliar' | 'medico'; competencias: string[] }
export interface TurnoGerado { data: string; tipo: Turno; ids: string[] }
export interface Falta { data: string; tipo: Turno; motivo: string }

const diaSeguinte = (d: string, n = 1) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** Segunda-feira da semana (ISO) do dia — para o limite de horas semanais. */
const semana = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

/**
 * Gera os turnos de um mês respeitando, por pessoa:
 *  - um turno por dia;
 *  - descanso depois da noite: a seguir a uma noite, não faz manhã nem tarde no dia seguinte;
 *  - no máximo duas noites seguidas;
 *  - o limite de horas semanais;
 *  - as ausências aprovadas.
 * Por turno: os mínimos de cada grupo e, se configurada, a competência obrigatória (pelo menos um
 * enfermeiro com ela). O que não se consegue cumprir não se esconde — vai para `faltas`.
 * Reparte por quem tem menos horas no mês (equidade); empates resolvidos por ordem estável.
 */
export function gerarEscala(entrada: {
  dias: string[];
  profissionais: Profissional[];
  ausente: (id: string, dia: string) => boolean;
  existentes: Set<string>; // `${dia}_${turno}` já criados nesta escala
  p: Parametros;
}): { turnos: TurnoGerado[]; faltas: Falta[] } {
  const { dias, profissionais, ausente, existentes, p } = entrada;
  const horasMes = new Map<string, number>();
  const horasSemana = new Map<string, number>(); // `${id}_${semana}`
  const turnoDoDia = new Map<string, Turno>(); // `${id}_${dia}`
  const turnos: TurnoGerado[] = [];
  const faltas: Falta[] = [];

  const pode = (pr: Profissional, dia: string, t: Turno) => {
    if (ausente(pr.id, dia) || turnoDoDia.has(`${pr.id}_${dia}`)) return false;
    const ontem = turnoDoDia.get(`${pr.id}_${diaSeguinte(dia, -1)}`);
    if (ontem === 'noite' && t !== 'noite') return false;
    if (t === 'noite' && ontem === 'noite' && turnoDoDia.get(`${pr.id}_${diaSeguinte(dia, -2)}`) === 'noite') return false;
    return (horasSemana.get(`${pr.id}_${semana(dia)}`) ?? 0) + HORAS_TURNO <= p.horasSemanaisMax;
  };
  const marcar = (pr: Profissional, dia: string, t: Turno) => {
    turnoDoDia.set(`${pr.id}_${dia}`, t);
    horasMes.set(pr.id, (horasMes.get(pr.id) ?? 0) + HORAS_TURNO);
    const k = `${pr.id}_${semana(dia)}`;
    horasSemana.set(k, (horasSemana.get(k) ?? 0) + HORAS_TURNO);
  };

  for (const dia of dias) {
    // A noite primeiro: quem fica de noite já não entra de manhã ou tarde nesse dia.
    for (const t of ['noite', 'manha', 'tarde'] as Turno[]) {
      if (existentes.has(`${dia}_${t}`)) continue;
      const escolhidos: Profissional[] = [];
      for (const role of ['enfermeiro', 'auxiliar', 'medico'] as const) {
        const n = p.minimos[t]?.[role] ?? 0;
        if (n === 0) continue;
        const candidatos = profissionais.filter((pr) => pr.role === role && pode(pr, dia, t))
          .sort((a, b) => (horasMes.get(a.id) ?? 0) - (horasMes.get(b.id) ?? 0) || a.id.localeCompare(b.id));
        let sel = candidatos.slice(0, n);
        if (role === 'enfermeiro' && p.competenciaObrigatoria) {
          const comp = p.competenciaObrigatoria;
          if (!sel.some((x) => x.competencias.includes(comp))) {
            const comCompetencia = candidatos.find((x) => x.competencias.includes(comp));
            if (comCompetencia && sel.length) sel = [...sel.slice(0, -1), comCompetencia];
            else if (comCompetencia) sel = [comCompetencia];
            else faltas.push({ data: dia, tipo: t, motivo: `sem enfermeiro com ${comp}` });
          }
        }
        if (sel.length < n) faltas.push({ data: dia, tipo: t, motivo: `${role}: ${sel.length} de ${n}` });
        for (const x of sel) { marcar(x, dia, t); escolhidos.push(x); }
      }
      if (escolhidos.length) turnos.push({ data: dia, tipo: t, ids: escolhidos.map((x) => x.id) });
    }
  }
  return { turnos, faltas };
}
