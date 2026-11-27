/**
 * SEC-14 — acesso ao doente por atribuição, com prazo.
 *
 * Antes bastava uma atribuição em QUALQUER turno, de qualquer data: quem cuidou do doente há
 * dois anos continuava a abrir o processo dele para sempre, sem break-glass nem registo de
 * motivo. Agora a atribuição dá acesso durante o turno e nos dias seguintes (continuidade de
 * cuidados: notas em atraso, carta de alta, reavaliação), e depois deixa de dar.
 */
export const DIAS_CONTINUIDADE = (() => {
  const n = Number(process.env['ACESSO_CONTINUIDADE_DIAS']);
  return Number.isFinite(n) && n >= 0 ? n : 7;
})();

/** Papéis que nunca têm acesso clínico, nem por break-glass (QA-11). */
export const PAPEIS_SEM_ACESSO_CLINICO = ['ti', 'administrativo'];

export function limiteContinuidade(agora = new Date(), dias = DIAS_CONTINUIDADE): Date {
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}

/** O utilizador está (ou esteve, dentro do prazo de continuidade) atribuído ao doente? */
export async function temAtribuicaoEmVigor(prisma: any, utilizadorId: string, doenteId: string, agora = new Date()): Promise<boolean> {
  const desde = limiteContinuidade(agora);
  const [direta, emTurno] = await Promise.all([
    prisma.atribuicaoDoente.findFirst({ where: { doenteId, enfermeiroId: utilizadorId, turno: { dataFim: { gte: desde } } }, select: { id: true } }),
    // `data` do horário é o início do dia clínico; o turno acaba, no máximo, um dia depois.
    prisma.atribuicaoHorarioTurno.findFirst({
      where: { doenteId, utilizadorId, horarioTurno: { data: { gte: new Date(desde.getTime() - 24 * 60 * 60 * 1000) } } },
      select: { id: true },
    }),
  ]);
  return Boolean(direta || emTurno);
}
