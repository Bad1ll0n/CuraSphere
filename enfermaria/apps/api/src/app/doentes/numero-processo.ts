/** Próximo nº de processo do ano ("2026-00000042"), dentro da transação de quem cria o doente. */
export async function gerarNumeroProcesso(tx: { doente: { findFirst: (args: any) => Promise<{ numeroProcesso: string } | null> } }): Promise<string> {
  const ano = new Date().getFullYear();
  const prefixo = `${ano}-`;
  const ultimo = await tx.doente.findFirst({
    where: { numeroProcesso: { startsWith: prefixo } },
    orderBy: { numeroProcesso: 'desc' },
    select: { numeroProcesso: true },
  });
  const proximoNum = ultimo ? parseInt(ultimo.numeroProcesso.split('-')[1], 10) + 1 : 1;
  return `${ano}-${String(proximoNum).padStart(8, '0')}`;
}
