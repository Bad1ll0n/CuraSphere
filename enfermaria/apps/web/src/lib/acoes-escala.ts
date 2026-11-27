/**
 * PROD-21 — depois de gravar uma escala, diz que tarefa gerou (NRS-2002 → nutrição, Barthel →
 * planeamento da alta, Morse/Braden alto → prevenção…). O texto vem da api, com o resultado.
 */
export function avisarAcoesGeradas(
  toast: { info: (m: string, o?: { duracao?: number }) => void },
  resposta: { acoesGeradas?: { descricao: string }[] } | undefined,
): void {
  for (const a of resposta?.acoesGeradas ?? []) toast.info(`Tarefa criada — ${a.descricao}`, { duracao: 10_000 });
}
