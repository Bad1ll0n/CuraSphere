import { ForbiddenException } from '@nestjs/common';

/**
 * SEC-19 — finalidades de tratamento que dependem da vontade do doente.
 *
 * O cuidado directo tem fundamento próprio (RGPD art.º 9.º/2/h) e não depende disto. As três
 * finalidades abaixo vão além dele:
 *  - partilha com familiares e conta no portal: só com CONSENTIMENTO registado (art.º 9.º/2/a);
 *  - IA clínica (dados pseudonimizados enviados a um subcontratante): permitida, salvo
 *    OPOSIÇÃO do doente (art.º 21.º).
 * A decisão em vigor é a linha mais recente não revogada de cada finalidade.
 */
export const FINALIDADES_TRATAMENTO = {
  partilha_familiares: { regime: 'consentimento', descricao: 'Partilha do estado geral com familiares (link de acesso)' },
  portal_doente: { regime: 'consentimento', descricao: 'Conta no portal do doente' },
  ia_clinica: { regime: 'oposicao', descricao: 'Uso de IA clínica com dados pseudonimizados (subcontratante fora do hospital)' },
} as const;

export type FinalidadeTratamento = keyof typeof FINALIDADES_TRATAMENTO;
export type DecisaoTratamento = 'consentimento' | 'oposicao';

export function eFinalidade(f: string): f is FinalidadeTratamento {
  return Object.prototype.hasOwnProperty.call(FINALIDADES_TRATAMENTO, f);
}

/** Basta o delegate — qualquer PrismaService (ou transacção) serve. */
interface Db {
  consentimentoTratamento: {
    findFirst(args: any): Promise<{ decisao: string } | null>;
    findMany(args: any): Promise<Array<{ doenteId: string }>>;
  };
}

export async function decisaoEmVigor(db: Db, doenteId: string, finalidade: FinalidadeTratamento): Promise<DecisaoTratamento | null> {
  const r = await db.consentimentoTratamento.findFirst({
    where: { doenteId, finalidade, revogadoEm: null },
    orderBy: { registadoEm: 'desc' },
    select: { decisao: true },
  });
  return (r?.decisao as DecisaoTratamento) ?? null;
}

/** A finalidade está permitida para este doente, segundo o seu regime? */
export async function tratamentoPermitido(db: Db, doenteId: string, finalidade: FinalidadeTratamento): Promise<boolean> {
  const d = await decisaoEmVigor(db, doenteId, finalidade);
  return FINALIDADES_TRATAMENTO[finalidade].regime === 'consentimento' ? d === 'consentimento' : d !== 'oposicao';
}

export async function exigirTratamentoPermitido(db: Db, doenteId: string, finalidade: FinalidadeTratamento): Promise<void> {
  if (await tratamentoPermitido(db, doenteId, finalidade)) return;
  const f = FINALIDADES_TRATAMENTO[finalidade];
  throw new ForbiddenException(
    f.regime === 'consentimento'
      ? `Sem consentimento do doente registado para: ${f.descricao.toLowerCase()}. Registe-o em "Consentimentos (RGPD)".`
      : `O doente opôs-se a: ${f.descricao.toLowerCase()}.`,
  );
}

/** Dos doentes indicados, os que se opuseram à IA clínica. */
export async function doentesComOposicaoIA(db: Db, doenteIds: string[]): Promise<Set<string>> {
  if (doenteIds.length === 0) return new Set();
  const linhas = await db.consentimentoTratamento.findMany({
    where: { doenteId: { in: doenteIds }, finalidade: 'ia_clinica', revogadoEm: null },
    orderBy: { registadoEm: 'desc' },
    select: { doenteId: true, decisao: true },
  });
  const vistos = new Set<string>();
  const oposicao = new Set<string>();
  for (const l of linhas as Array<{ doenteId: string; decisao: string }>) {
    if (vistos.has(l.doenteId)) continue; // só conta a mais recente
    vistos.add(l.doenteId);
    if (l.decisao === 'oposicao') oposicao.add(l.doenteId);
  }
  return oposicao;
}
