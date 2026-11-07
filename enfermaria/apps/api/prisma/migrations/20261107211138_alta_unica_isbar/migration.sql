-- AlterTable
ALTER TABLE "sumarios_alta" ADD COLUMN     "justificacaoRequisitos" TEXT,
ADD COLUMN     "requisitosEmFalta" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "reconciliacao_alta_linhas" (
    "id" TEXT NOT NULL,
    "episodioId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "medicacaoId" TEXT,
    "nome" TEXT NOT NULL,
    "dose" TEXT,
    "via" TEXT,
    "frequencia" TEXT,
    "decisao" TEXT NOT NULL,
    "notas" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliacao_alta_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_alta_enfermagem" (
    "id" TEXT NOT NULL,
    "episodioId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "autonomia" TEXT,
    "necessidades" TEXT,
    "ensinos" TEXT,
    "dispositivos" TEXT,
    "feridas" TEXT,
    "cuidador" TEXT,
    "referenciacao" TEXT,
    "observacoes" TEXT,
    "autorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_alta_enfermagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passagens_isbar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "doenteId" TEXT NOT NULL,
    "episodioId" TEXT,
    "servico" TEXT,
    "data" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "identificacao" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "antecedentes" TEXT NOT NULL,
    "avaliacao" TEXT NOT NULL,
    "recomendacoes" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "autorId" TEXT NOT NULL,
    "entregueEm" TIMESTAMP(3),
    "recebidaPorId" TEXT,
    "recebidaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passagens_isbar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reconciliacao_alta_linhas_episodioId_idx" ON "reconciliacao_alta_linhas"("episodioId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_alta_enfermagem_episodioId_key" ON "notas_alta_enfermagem"("episodioId");

-- CreateIndex
CREATE INDEX "notas_alta_enfermagem_doenteId_idx" ON "notas_alta_enfermagem"("doenteId");

-- CreateIndex
CREATE INDEX "passagens_isbar_servico_data_turno_idx" ON "passagens_isbar"("servico", "data", "turno");

-- CreateIndex
CREATE INDEX "passagens_isbar_estado_idx" ON "passagens_isbar"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "passagens_isbar_doenteId_data_turno_key" ON "passagens_isbar"("doenteId", "data", "turno");

-- AddForeignKey
ALTER TABLE "reconciliacao_alta_linhas" ADD CONSTRAINT "reconciliacao_alta_linhas_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_alta_enfermagem" ADD CONSTRAINT "notas_alta_enfermagem_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_isbar" ADD CONSTRAINT "passagens_isbar_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_internamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
