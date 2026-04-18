-- CreateEnum
CREATE TYPE "EstadoInterconsulta" AS ENUM ('pendente', 'aceite', 'respondida', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoDispositivoInvasivo" AS ENUM ('cateter_venoso_central', 'cateter_venoso_periferico', 'cateter_arterial', 'sonda_vesical', 'tubo_orotaqueal', 'traqueostomia', 'dreno_toracico', 'sonda_nasogastrica', 'linha_epidural', 'outro');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEscalaClinica" ADD VALUE 'Barthel';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'FIM';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'MRC';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'FOIS';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'NRS2002';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'PHQ9';
ALTER TYPE "TipoEscalaClinica" ADD VALUE 'GAD7';

-- AlterTable
ALTER TABLE "medicacoes" ADD COLUMN     "estadoValidacao" TEXT,
ADD COLUMN     "motivoRejeicao" TEXT,
ADD COLUMN     "validadaEm" TIMESTAMP(3),
ADD COLUMN     "validadoPorId" TEXT;

-- CreateTable
CREATE TABLE "interconsultas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "requisitanteId" TEXT NOT NULL,
    "especialidadeAlvo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoInterconsulta" NOT NULL DEFAULT 'pendente',
    "medicoRespostaId" TEXT,
    "resposta" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "interconsultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_invasivos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" "TipoDispositivoInvasivo" NOT NULL,
    "localizacao" TEXT,
    "dataInsercao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRemocao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "inseridoPorId" TEXT NOT NULL,

    CONSTRAINT "dispositivos_invasivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interconsultas_doenteId_idx" ON "interconsultas"("doenteId");

-- CreateIndex
CREATE INDEX "interconsultas_especialidadeAlvo_estado_idx" ON "interconsultas"("especialidadeAlvo", "estado");

-- CreateIndex
CREATE INDEX "interconsultas_requisitanteId_estado_idx" ON "interconsultas"("requisitanteId", "estado");

-- CreateIndex
CREATE INDEX "dispositivos_invasivos_doenteId_ativo_idx" ON "dispositivos_invasivos"("doenteId", "ativo");

-- CreateIndex
CREATE INDEX "audit_logs_utilizadorId_createdAt_idx" ON "audit_logs"("utilizadorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "doentes_ativo_idx" ON "doentes"("ativo");

-- CreateIndex
CREATE INDEX "doentes_estado_idx" ON "doentes"("estado");

-- CreateIndex
CREATE INDEX "doentes_dataAdmissao_idx" ON "doentes"("dataAdmissao");

-- CreateIndex
CREATE INDEX "escalas_clinicas_doenteId_tipo_idx" ON "escalas_clinicas"("doenteId", "tipo");

-- CreateIndex
CREATE INDEX "exames_estado_urgente_idx" ON "exames"("estado", "urgente");

-- CreateIndex
CREATE INDEX "exames_doenteId_estado_idx" ON "exames"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "medicacoes_doenteId_ativo_idx" ON "medicacoes"("doenteId", "ativo");

-- CreateIndex
CREATE INDEX "medicacoes_estadoValidacao_idx" ON "medicacoes"("estadoValidacao");

-- CreateIndex
CREATE INDEX "notas_clinicas_doenteId_criadaEm_idx" ON "notas_clinicas"("doenteId", "criadaEm");

-- CreateIndex
CREATE INDEX "tarefas_doenteId_estado_idx" ON "tarefas"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "tarefas_responsavelId_estado_idx" ON "tarefas"("responsavelId", "estado");

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_requisitanteId_fkey" FOREIGN KEY ("requisitanteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_medicoRespostaId_fkey" FOREIGN KEY ("medicoRespostaId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_inseridoPorId_fkey" FOREIGN KEY ("inseridoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
