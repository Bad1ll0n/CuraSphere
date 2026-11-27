/**
 * PROD-18 — indicadores sensíveis aos cuidados de enfermagem, com DEFINIÇÃO VERSIONADA.
 *
 * Cada indicador diz o que conta no numerador, no denominador e o que fica de fora. A versão
 * muda sempre que a definição muda — um valor de 2026 e um de 2027 só se comparam se a versão for
 * a mesma. As definições seguem as usadas em acreditação (JCI/ACSA) e nos contratos-programa,
 * mas a tradução para os dados do CuraSphere está aqui à vista para ser revista pela qualidade.
 */
export type Unidade = 'por_1000_dias' | 'percentagem' | 'minutos';

export interface Definicao {
  codigo: string;
  versao: string;
  nome: string;
  numerador: string;
  denominador: string;
  exclusoes: string;
  unidade: Unidade;
  /** Sentido desejável (para colorir a tendência). */
  melhor: 'baixo' | 'alto';
}

export const DEFINICOES: Definicao[] = [
  {
    codigo: 'quedas', versao: '1', nome: 'Quedas por 1000 dias de internamento', unidade: 'por_1000_dias', melhor: 'baixo',
    numerador: 'Eventos adversos do tipo "queda" ocorridos durante um internamento, no período.',
    denominador: 'Dias de internamento no período (soma, por episódio, do tempo internado dentro do período).',
    exclusoes: 'Quedas sem doente identificado ou fora de um internamento.',
  },
  {
    codigo: 'upp_adquiridas', versao: '1', nome: 'Úlceras por pressão adquiridas por 1000 dias de internamento', unidade: 'por_1000_dias', melhor: 'baixo',
    numerador: 'Úlceras por pressão (avaliação de ferida tipo "ulcera_pressao") registadas pela primeira vez mais de 24 h depois da admissão, por doente e localização.',
    denominador: 'Dias de internamento no período.',
    exclusoes: 'Úlceras registadas nas primeiras 24 h (presentes na admissão) e localizações já registadas antes no mesmo internamento.',
  },
  {
    codigo: 'avaliacao_risco_24h', versao: '1', nome: 'Avaliação do risco de queda e de úlcera nas primeiras 24 h', unidade: 'percentagem', melhor: 'alto',
    numerador: 'Internamentos com Morse E Braden registados até 24 h depois da admissão.',
    denominador: 'Internamentos iniciados no período e com pelo menos 24 h.',
    exclusoes: 'Internamentos com menos de 24 h.',
  },
  {
    codigo: 'dor_por_turno', versao: '1', nome: 'Turnos com a dor avaliada', unidade: 'percentagem', melhor: 'alto',
    numerador: 'Turnos completos (manhã, tarde, noite) em que o doente teve pelo menos um registo de dor nos sinais vitais.',
    denominador: 'Turnos completos de doentes internados no período (máximo 31 dias).',
    exclusoes: 'Turnos em que o doente não esteve internado do início ao fim.',
  },
  {
    codigo: 'infecao_dispositivo', versao: '1', nome: 'Possível infeção associada a dispositivo por 1000 dias de dispositivo', unidade: 'por_1000_dias', melhor: 'baixo',
    numerador: 'Culturas positivas colhidas com um cateter venoso central, sonda vesical ou tubo orotraqueal colocado há mais de 48 h (indicador de vigilância — a confirmação é da Comissão de Controlo de Infeção).',
    denominador: 'Dias de dispositivo (CVC, sonda vesical, tubo orotraqueal) no período.',
    exclusoes: 'Culturas contaminadas ou negativas; dispositivos com menos de 48 h.',
  },
  {
    codigo: 'reinternamento_30d', versao: '1', nome: 'Reinternamentos a 30 dias', unidade: 'percentagem', melhor: 'baixo',
    numerador: 'Altas do período seguidas de um novo internamento do mesmo doente até 30 dias depois.',
    denominador: 'Altas do período.',
    exclusoes: 'Altas por óbito.',
  },
  {
    codigo: 'tempo_urgencia_cama', versao: '1', nome: 'Tempo da urgência até à cama (mediana)', unidade: 'minutos', melhor: 'baixo',
    numerador: 'Mediana dos minutos entre a entrada na urgência e a admissão no internamento.',
    denominador: 'Internamentos do período com origem num episódio de urgência.',
    exclusoes: 'Internamentos sem episódio de urgência associado.',
  },
];

const H = 3_600_000;
const DIA = 24 * H;

/** Interseção (ms) de [a0, a1) com [b0, b1). */
export function sobreposicao(a0: Date, a1: Date | null, b0: Date, b1: Date): number {
  const fim = Math.min((a1 ?? b1).getTime(), b1.getTime());
  return Math.max(0, fim - Math.max(a0.getTime(), b0.getTime()));
}

/** Taxa por 1000 dias, arredondada a 2 casas; null sem denominador. */
export function por1000(numerador: number, dias: number): number | null {
  return dias > 0 ? Math.round((numerador / dias) * 1000 * 100) / 100 : null;
}

export function percentagem(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export interface EpisodioBase { id: string; doenteId: string; dataAdmissao: Date; dataAlta: Date | null; motivoAlta?: string | null; numero: number }

/** Dias de internamento dentro do período (soma das sobreposições). */
export function diasInternamento(episodios: EpisodioBase[], inicio: Date, fim: Date): number {
  return episodios.reduce((t, e) => t + sobreposicao(e.dataAdmissao, e.dataAlta, inicio, fim), 0) / DIA;
}

/** Turnos completos (08–16, 16–24, 00–08, hora local aproximada por UTC) de um episódio no período. */
export function turnosCompletos(e: EpisodioBase, inicio: Date, fim: Date): [Date, Date][] {
  const ini = Math.max(e.dataAdmissao.getTime(), inicio.getTime());
  const fi = Math.min((e.dataAlta ?? fim).getTime(), fim.getTime());
  const out: [Date, Date][] = [];
  const dia0 = new Date(ini); dia0.setUTCHours(0, 0, 0, 0);
  for (let d = dia0.getTime(); d < fi; d += DIA) {
    for (const [h0, h1] of [[0, 8], [8, 16], [16, 24]]) {
      const a = d + h0 * H, b = d + h1 * H;
      if (a >= ini && b <= fi) out.push([new Date(a), new Date(b)]);
    }
  }
  return out;
}

/** Reinternamento: para cada alta (não óbito), há outro episódio do mesmo doente que começa até 30 dias depois. */
export function reinternamentos(episodios: EpisodioBase[], inicio: Date, fim: Date) {
  const altas = episodios.filter((e) => e.dataAlta && e.dataAlta >= inicio && e.dataAlta < fim && e.motivoAlta !== 'obito');
  const casos = altas.filter((a) => episodios.some((o) => o.doenteId === a.doenteId && o.numero > a.numero
    && o.dataAdmissao.getTime() >= a.dataAlta!.getTime() && o.dataAdmissao.getTime() - a.dataAlta!.getTime() <= 30 * DIA));
  return { altas, casos };
}

export const DISPOSITIVOS_VIGIADOS = ['cateter_venoso_central', 'sonda_vesical', 'tubo_orotaqueal'];
export const H48 = 48 * H;
