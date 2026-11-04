/**
 * Fronteira do dia clínico (BE-03).
 *
 * O defeito que este helper existe para eliminar: o código agrupava registos por dia
 * misturando dois relógios. Construía o início do intervalo com `setHours(0,0,0,0)` —
 * meia-noite **local** — e derivava a chave de agrupamento com `toISOString()`, que é
 * **UTC**. Em `Europe/Lisbon` no verão (UTC+1) a meia-noite local é 23:00Z do dia
 * anterior, portanto a chave saía com o dia errado: o primeiro dia do gráfico aparecia
 * sempre a zero e os registos do fim do último dia caíam num *bucket* fantasma.
 *
 * Passava em CI, que corre em UTC, e falhava em produção — que é o pior modo de falha
 * possível, porque a suite verde dava garantia falsa.
 *
 * A correcção não é "usar sempre UTC" nem "usar sempre a hora local do servidor": num
 * sistema hospitalar o dia clínico é o dia **do hospital**. Um servidor mudado de região,
 * ou um contentor sem `TZ` definida, não pode deslocar a fronteira entre turnos. Por isso
 * a zona é explícita e configurável, e o cálculo é feito com `Intl`, que conhece o
 * horário de verão — em vez de somar um desvio fixo.
 */

/** Zona do hospital. Configurável para instalações fora de Portugal continental. */
const TZ_CLINICO = process.env['TZ_CLINICO'] ?? 'Europe/Lisbon';

/**
 * Desvio da zona, em minutos, no instante dado (positivo a leste de Greenwich).
 * Calculado por comparação: formata-se o instante na zona e lê-se de volta como se
 * fosse UTC; a diferença é o desvio em vigor naquele instante — já com verão/inverno.
 */
function desvioMinutos(instante: Date, tz: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instante);

  const p: Record<string, string> = {};
  for (const parte of partes) p[parte.type] = parte.value;

  // `hour` pode vir '24' em vez de '00' à meia-noite nalguns ambientes.
  const hora = Number(p['hour']) % 24;
  const comoSeUtc = Date.UTC(
    Number(p['year']), Number(p['month']) - 1, Number(p['day']),
    hora, Number(p['minute']), Number(p['second']),
  );
  return (comoSeUtc - instante.getTime()) / 60000;
}

/**
 * Chave de agrupamento por dia clínico, no formato `YYYY-MM-DD`.
 * É esta função — e nunca `toISOString().split('T')[0]` — que deve produzir chaves de dia.
 */
export function chaveDiaClinico(instante: Date, tz: string = TZ_CLINICO): string {
  // `en-CA` formata como YYYY-MM-DD, que é o formato que o resto do código já espera.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instante);
}

/**
 * O instante em que começa o dia clínico a que `instante` pertence (00:00 na zona do
 * hospital), devolvido como `Date` para ir directo a um `where` do Prisma.
 */
export function inicioDoDiaClinico(instante: Date = new Date(), tz: string = TZ_CLINICO): Date {
  const chave = chaveDiaClinico(instante, tz);
  const [ano, mes, dia] = chave.split('-').map(Number);

  // Primeiro palpite: meia-noite UTC desse dia civil. Depois corrige-se pelo desvio em
  // vigor. A correcção é iterada uma segunda vez porque nos dias de mudança de hora o
  // desvio no palpite pode não ser o mesmo que vigora já dentro do dia corrigido.
  let candidato = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0));
  for (let i = 0; i < 2; i++) {
    candidato = new Date(
      Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0) - desvioMinutos(candidato, tz) * 60000,
    );
  }
  return candidato;
}

/**
 * Início do dia clínico de há `dias` dias (0 = hoje). Substitui o padrão
 * `d.setDate(d.getDate() - n); d.setHours(0,0,0,0)`.
 */
export function inicioDoDiaClinicoHaDias(dias: number, tz: string = TZ_CLINICO): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() - dias);
  return inicioDoDiaClinico(base, tz);
}

/** Avança `n` dias civis a partir de um início de dia clínico, respeitando o verão. */
export function somarDiasClinicos(inicio: Date, n: number, tz: string = TZ_CLINICO): Date {
  const chave = chaveDiaClinico(inicio, tz);
  const [ano, mes, dia] = chave.split('-').map(Number);
  return inicioDoDiaClinico(new Date(Date.UTC(ano, mes - 1, dia + n, 12, 0, 0)), tz);
}
