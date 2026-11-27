/** PERF-12 — chave e pedido da lista da passagem de turno, partilhados pelo servidor e pelo browser. */
export const chavePassagem = (servico: string) => ['passagem-isbar', servico] as const;
export const caminhoPassagem = (servico: string) => (servico ? `/passagem-isbar?servico=${encodeURIComponent(servico)}` : '/passagem-isbar');
