/**
 * PROD-02 — os seeds criam doentes internados directamente na tabela; sem isto ficavam sem
 * episódio de internamento (e sem plano de alta). Mesma regra da migração
 * `episodio_internamento`: um episódio por doente internado/à espera de cama que não tenha um.
 */
export async function abrirEpisodiosEmFalta(prisma: { $executeRawUnsafe: (sql: string) => Promise<number> }): Promise<number> {
  const n = await prisma.$executeRawUnsafe(`
    INSERT INTO "episodios_internamento" ("id", "tenantId", "doenteId", "numero", "origem", "estado", "servico", "camaId",
      "diagnosticoPrincipal", "icd10Code", "dataAdmissao", "dataAlta", "alergiasRevistasEm")
    SELECT gen_random_uuid()::text, d."tenantId", d.id, 1, 'admissao',
           CASE WHEN d.ativo AND d."dataAlta" IS NULL THEN 'ativo' ELSE 'alta' END,
           c.servico, d."camaId", d."diagnosticoPrincipal", d."icd10Code", d."dataAdmissao",
           CASE WHEN d.ativo AND d."dataAlta" IS NULL THEN NULL ELSE COALESCE(d."dataAlta", d."dataAdmissao") END,
           d."dataAdmissao"
    FROM "doentes" d
    LEFT JOIN "camas" c ON c.id = d."camaId"
    WHERE (d."estadoRegisto" IN ('internado', 'pendente_cama') OR d."dataAlta" IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM "episodios_internamento" e WHERE e."doenteId" = d.id)`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "planos_alta" ("id", "doenteId", "episodioId")
    SELECT gen_random_uuid()::text, e."doenteId", e.id FROM "episodios_internamento" e
    WHERE NOT EXISTS (SELECT 1 FROM "planos_alta" p WHERE p."episodioId" = e.id)`);
  return n;
}
