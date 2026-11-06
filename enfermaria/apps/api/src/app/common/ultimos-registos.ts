import { Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * PERF-03 — "o último X de cada doente/medicação" numa só query, pelo índice.
 *
 * O padrão `include: { sinaisVitais: { orderBy: { data: 'desc' }, take: 1 } }` numa lista NÃO
 * gera um LIMIT por doente: o Prisma lê o histórico INTEIRO de todos os doentes e corta em
 * memória (medido: 57 501 linhas transferidas para usar 2 303). O custo crescia com os anos de
 * histórico, não com as camas. `LATERAL (… ORDER BY data DESC LIMIT 1)` lê UMA linha por
 * chave, pelo índice composto (`(doenteId, data)`, percorrido de trás para a frente).
 *
 * Medido com 300 doentes × 200 sinais vitais: padrão antigo 27 ms na BD + 60 000 linhas
 * transferidas; `DISTINCT ON` 75 ms (lê tudo e ordena); `LATERAL … LIMIT 1` 2 ms e 300 linhas.
 */
export async function ultimosSinaisVitais(
  prisma: PrismaService,
  doenteIds: string[],
  opts: { comNews2?: boolean } = {},
): Promise<Map<string, { news2: number | null; data: Date }>> {
  if (doenteIds.length === 0) return new Map();
  const filtroNews2 = opts.comNews2 ? Prisma.sql`AND news2 IS NOT NULL` : Prisma.empty;
  const linhas = await prisma.$queryRaw<Array<{ doenteId: string; news2: number | null; data: Date }>>`
    SELECT d.id AS "doenteId", sv.news2, sv.data
      FROM unnest(${doenteIds}::text[]) AS d(id)
      CROSS JOIN LATERAL (
        SELECT news2, data FROM sinais_vitais
         WHERE "doenteId" = d.id ${filtroNews2}
         ORDER BY data DESC LIMIT 1
      ) sv`;
  return new Map(linhas.map((l) => [l.doenteId, { news2: l.news2, data: l.data }]));
}

/** Última administração (efectiva) de cada medicação — índice `(medicacaoId, administradoEm DESC)`. */
export async function ultimasAdministracoes(
  prisma: PrismaService,
  medicacaoIds: string[],
): Promise<Map<string, Date>> {
  if (medicacaoIds.length === 0) return new Map();
  const linhas = await prisma.$queryRaw<Array<{ medicacaoId: string; administradoEm: Date }>>`
    SELECT m.id AS "medicacaoId", r."administradoEm"
      FROM unnest(${medicacaoIds}::text[]) AS m(id)
      CROSS JOIN LATERAL (
        SELECT "administradoEm" FROM registos_medicacao
         WHERE "medicacaoId" = m.id AND "naoAdministrada" = false AND "deletedAt" IS NULL
         ORDER BY "administradoEm" DESC LIMIT 1
      ) r`;
  return new Map(linhas.map((l) => [l.medicacaoId, l.administradoEm]));
}
