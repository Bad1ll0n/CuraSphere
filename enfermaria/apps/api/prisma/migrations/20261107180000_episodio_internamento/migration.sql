
-- DropIndex
DROP INDEX "planos_alta_doenteId_key";

-- DropIndex
DROP INDEX "sumarios_alta_doenteId_key";

-- AlterTable
ALTER TABLE "camas" ADD COLUMN     "especialidade" TEXT,
ADD COLUMN     "isolamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservadaAte" TIMESTAMP(3),
ADD COLUMN     "reservadaPedidoId" TEXT,
ADD COLUMN     "sexo" TEXT;

-- AlterTable
ALTER TABLE "planos_alta" ADD COLUMN     "episodioId" TEXT;

-- AlterTable
ALTER TABLE "sumarios_alta" ADD COLUMN     "episodioId" TEXT;

-- CreateTable
CREATE TABLE "episodios_internamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "doenteId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "origem" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ativo',
    "servico" TEXT,
    "camaId" TEXT,
    "diagnosticoPrincipal" TEXT,
    "icd10Code" TEXT,
    "dataAdmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAlta" TIMESTAMP(3),
    "motivoAlta" TEXT,
    "destinoAlta" TEXT,
    "episodioUrgenciaId" TEXT,
    "pedidoCamaId" TEXT,
    "alergiasRevistasEm" TIMESTAMP(3),
    "alergiasRevistasPorId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodios_internamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_internamento" (
    "id" TEXT NOT NULL,
    "episodioId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "deCamaId" TEXT,
    "paraCamaId" TEXT,
    "deServico" TEXT,
    "paraServico" TEXT,
    "motivo" TEXT NOT NULL,
    "realizadoPorId" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_internamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_cama" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "doenteId" TEXT,
    "episodioUrgenciaId" TEXT,
    "nomeTemporario" TEXT,
    "origem" TEXT NOT NULL,
    "servicoDestino" TEXT NOT NULL,
    "sexo" TEXT,
    "isolamento" BOOLEAN NOT NULL DEFAULT false,
    "motivoIsolamento" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "diagnostico" TEXT,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pedido',
    "camaId" TEXT,
    "pedidoPorId" TEXT NOT NULL,
    "pedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atribuidaPorId" TEXT,
    "atribuidaEm" TIMESTAMP(3),
    "justificacaoAtribuicao" TEXT,
    "ocupadaEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,

    CONSTRAINT "pedidos_cama_pkey" PRIMARY KEY ("id")
);

-- PROD-02: dados existentes — um episódio (n.º 1, origem 'migracao') por doente que foi
-- internado (estado de internamento, alta registada, ou sumário/plano de alta).
INSERT INTO "episodios_internamento" ("id", "tenantId", "doenteId", "numero", "origem", "estado", "servico", "camaId",
  "diagnosticoPrincipal", "icd10Code", "dataAdmissao", "dataAlta")
SELECT gen_random_uuid()::text, d."tenantId", d.id, 1, 'migracao',
       CASE WHEN d.ativo AND d."dataAlta" IS NULL THEN 'ativo' ELSE 'alta' END,
       c.servico, d."camaId", d."diagnosticoPrincipal", d."icd10Code", d."dataAdmissao",
       CASE WHEN d.ativo AND d."dataAlta" IS NULL THEN NULL ELSE COALESCE(d."dataAlta", d."dataAdmissao") END
FROM "doentes" d
LEFT JOIN "camas" c ON c.id = d."camaId"
WHERE d."estadoRegisto" IN ('internado', 'pendente_cama')
   OR d."dataAlta" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "sumarios_alta" s WHERE s."doenteId" = d.id)
   OR EXISTS (SELECT 1 FROM "planos_alta" p WHERE p."doenteId" = d.id);

UPDATE "sumarios_alta" s SET "episodioId" = e.id FROM "episodios_internamento" e WHERE e."doenteId" = s."doenteId";
UPDATE "planos_alta" p SET "episodioId" = e.id FROM "episodios_internamento" e WHERE e."doenteId" = p."doenteId";
ALTER TABLE "sumarios_alta" ALTER COLUMN "episodioId" SET NOT NULL;
ALTER TABLE "planos_alta" ALTER COLUMN "episodioId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "episodios_internamento_doenteId_estado_idx" ON "episodios_internamento"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "episodios_internamento_estado_servico_idx" ON "episodios_internamento"("estado", "servico");

-- CreateIndex
CREATE INDEX "episodios_internamento_dataAlta_idx" ON "episodios_internamento"("dataAlta");

-- CreateIndex
CREATE UNIQUE INDEX "episodios_internamento_doenteId_numero_key" ON "episodios_internamento"("doenteId", "numero");

-- CreateIndex
CREATE INDEX "movimentos_internamento_episodioId_em_idx" ON "movimentos_internamento"("episodioId", "em");

-- CreateIndex
CREATE INDEX "movimentos_internamento_doenteId_idx" ON "movimentos_internamento"("doenteId");

-- CreateIndex
CREATE INDEX "pedidos_cama_estado_servicoDestino_idx" ON "pedidos_cama"("estado", "servicoDestino");

-- CreateIndex
CREATE INDEX "pedidos_cama_doenteId_idx" ON "pedidos_cama"("doenteId");

-- CreateIndex
CREATE INDEX "pedidos_cama_episodioUrgenciaId_idx" ON "pedidos_cama"("episodioUrgenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "planos_alta_episodioId_key" ON "planos_alta"("episodioId");

-- CreateIndex
CREATE INDEX "planos_alta_doenteId_criadoEm_idx" ON "planos_alta"("doenteId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "sumarios_alta_episodioId_key" ON "sumarios_alta"("episodioId");

-- CreateIndex
CREATE INDEX "sumarios_alta_doenteId_criadoEm_idx" ON "sumarios_alta"("doenteId", "criadoEm");

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_alta" ADD CONSTRAINT "planos_alta_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_internamento" ADD CONSTRAINT "episodios_internamento_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_internamento" ADD CONSTRAINT "movimentos_internamento_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_cama" ADD CONSTRAINT "pedidos_cama_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_cama" ADD CONSTRAINT "pedidos_cama_episodioUrgenciaId_fkey" FOREIGN KEY ("episodioUrgenciaId") REFERENCES "episodios_urgencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

