-- CreateEnum
CREATE TYPE "TipoIncidenteTI" AS ENUM ('infraestrutura', 'rede', 'his_erp', 'base_dados', 'seguranca', 'dados_clinicos', 'outro');

-- CreateEnum
CREATE TYPE "EstadoIncidenteTI" AS ENUM ('aberto', 'em_analise', 'resolvido', 'fechado');

-- CreateEnum
CREATE TYPE "PrioridadeIncidenteTI" AS ENUM ('baixa', 'media', 'alta', 'critica');

-- CreateTable
CREATE TABLE "incidentes_ti" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoIncidenteTI" NOT NULL,
    "subRoleAlvo" TEXT,
    "prioridade" "PrioridadeIncidenteTI" NOT NULL DEFAULT 'media',
    "estado" "EstadoIncidenteTI" NOT NULL DEFAULT 'aberto',
    "criadoPorId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_ti_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidentes_ti_estado_idx" ON "incidentes_ti"("estado");

-- CreateIndex
CREATE INDEX "incidentes_ti_subRoleAlvo_idx" ON "incidentes_ti"("subRoleAlvo");

-- AddForeignKey
ALTER TABLE "incidentes_ti" ADD CONSTRAINT "incidentes_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_ti" ADD CONSTRAINT "incidentes_ti_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
