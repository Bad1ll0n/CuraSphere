-- CreateTable
CREATE TABLE "avaliacoes_iniciais_enfermagem" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "episodioId" TEXT,
    "dados" JSONB NOT NULL,
    "completa" BOOLEAN NOT NULL DEFAULT false,
    "avaliadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_iniciais_enfermagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_cuidados" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "foco" TEXT,
    "codigoCipe" TEXT,
    "servicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequenciaSugerida" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogo_cuidados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conjuntos_cuidados" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "servicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "itens" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conjuntos_cuidados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosticos_enfermagem" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "episodioId" TEXT,
    "catalogoId" TEXT,
    "termo" TEXT NOT NULL,
    "juizo" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "origemRef" TEXT,
    "resultadoEsperado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ativo',
    "identificadoPorId" TEXT NOT NULL,
    "identificadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "encerradoPorId" TEXT,
    "motivoEncerramento" TEXT,

    CONSTRAINT "diagnosticos_enfermagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervencoes_enfermagem" (
    "id" TEXT NOT NULL,
    "diagnosticoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "catalogoId" TEXT,
    "termo" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ativa',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPorId" TEXT NOT NULL,

    CONSTRAINT "intervencoes_enfermagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucoes_intervencao" (
    "id" TEXT NOT NULL,
    "intervencaoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "executadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executadaPorId" TEXT NOT NULL,
    "realizada" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "motivoNaoRealizada" TEXT,

    CONSTRAINT "execucoes_intervencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_diagnostico" (
    "id" TEXT NOT NULL,
    "diagnosticoId" TEXT NOT NULL,
    "evolucao" TEXT NOT NULL,
    "nota" TEXT,
    "avaliadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avaliadoPorId" TEXT NOT NULL,

    CONSTRAINT "avaliacoes_diagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avaliacoes_iniciais_enfermagem_doenteId_idx" ON "avaliacoes_iniciais_enfermagem"("doenteId");

-- CreateIndex
CREATE INDEX "avaliacoes_iniciais_enfermagem_avaliadoPorId_idx" ON "avaliacoes_iniciais_enfermagem"("avaliadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_cuidados_tipo_termo_key" ON "catalogo_cuidados"("tipo", "termo");

-- CreateIndex
CREATE UNIQUE INDEX "conjuntos_cuidados_nome_key" ON "conjuntos_cuidados"("nome");

-- CreateIndex
CREATE INDEX "diagnosticos_enfermagem_doenteId_estado_idx" ON "diagnosticos_enfermagem"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "diagnosticos_enfermagem_identificadoPorId_idx" ON "diagnosticos_enfermagem"("identificadoPorId");

-- CreateIndex
CREATE INDEX "diagnosticos_enfermagem_catalogoId_idx" ON "diagnosticos_enfermagem"("catalogoId");

-- CreateIndex
CREATE INDEX "intervencoes_enfermagem_diagnosticoId_idx" ON "intervencoes_enfermagem"("diagnosticoId");

-- CreateIndex
CREATE INDEX "intervencoes_enfermagem_doenteId_estado_idx" ON "intervencoes_enfermagem"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "intervencoes_enfermagem_catalogoId_idx" ON "intervencoes_enfermagem"("catalogoId");

-- CreateIndex
CREATE INDEX "intervencoes_enfermagem_criadaPorId_idx" ON "intervencoes_enfermagem"("criadaPorId");

-- CreateIndex
CREATE INDEX "execucoes_intervencao_intervencaoId_executadaEm_idx" ON "execucoes_intervencao"("intervencaoId", "executadaEm");

-- CreateIndex
CREATE INDEX "execucoes_intervencao_doenteId_idx" ON "execucoes_intervencao"("doenteId");

-- CreateIndex
CREATE INDEX "execucoes_intervencao_executadaPorId_idx" ON "execucoes_intervencao"("executadaPorId");

-- CreateIndex
CREATE INDEX "avaliacoes_diagnostico_diagnosticoId_idx" ON "avaliacoes_diagnostico"("diagnosticoId");

-- CreateIndex
CREATE INDEX "avaliacoes_diagnostico_avaliadoPorId_idx" ON "avaliacoes_diagnostico"("avaliadoPorId");

-- AddForeignKey
ALTER TABLE "avaliacoes_iniciais_enfermagem" ADD CONSTRAINT "avaliacoes_iniciais_enfermagem_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_iniciais_enfermagem" ADD CONSTRAINT "avaliacoes_iniciais_enfermagem_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosticos_enfermagem" ADD CONSTRAINT "diagnosticos_enfermagem_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosticos_enfermagem" ADD CONSTRAINT "diagnosticos_enfermagem_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_cuidados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosticos_enfermagem" ADD CONSTRAINT "diagnosticos_enfermagem_identificadoPorId_fkey" FOREIGN KEY ("identificadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervencoes_enfermagem" ADD CONSTRAINT "intervencoes_enfermagem_diagnosticoId_fkey" FOREIGN KEY ("diagnosticoId") REFERENCES "diagnosticos_enfermagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervencoes_enfermagem" ADD CONSTRAINT "intervencoes_enfermagem_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_cuidados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervencoes_enfermagem" ADD CONSTRAINT "intervencoes_enfermagem_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_intervencao" ADD CONSTRAINT "execucoes_intervencao_intervencaoId_fkey" FOREIGN KEY ("intervencaoId") REFERENCES "intervencoes_enfermagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_intervencao" ADD CONSTRAINT "execucoes_intervencao_executadaPorId_fkey" FOREIGN KEY ("executadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_diagnostico" ADD CONSTRAINT "avaliacoes_diagnostico_diagnosticoId_fkey" FOREIGN KEY ("diagnosticoId") REFERENCES "diagnosticos_enfermagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_diagnostico" ADD CONSTRAINT "avaliacoes_diagnostico_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

