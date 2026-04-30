-- CreateEnum
CREATE TYPE "EstadoFatura" AS ENUM ('pendente', 'emitida', 'paga', 'isenta', 'anulada');

-- CreateTable
CREATE TABLE "fichas_pessoais_doente" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "nif" TEXT,
    "numeroSNS" TEXT,
    "morada" TEXT,
    "codigoPostal" TEXT,
    "localidade" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "entidadeSeguradora" TEXT,
    "numeroApolice" TEXT,
    "tipoCobertura" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "fichas_pessoais_doente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodios_faturacao" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "estado" "EstadoFatura" NOT NULL DEFAULT 'pendente',
    "dataEmissao" TIMESTAMP(3),
    "totalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCobrado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipoCobertura" TEXT,
    "notas" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodios_faturacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_fatura" (
    "id" TEXT NOT NULL,
    "episodioFaturacaoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "episodioFaturacaoId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT NOT NULL,
    "referencia" TEXT,
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichas_pessoais_doente_doenteId_key" ON "fichas_pessoais_doente"("doenteId");

-- CreateIndex
CREATE INDEX "episodios_faturacao_doenteId_idx" ON "episodios_faturacao"("doenteId");

-- CreateIndex
CREATE INDEX "episodios_faturacao_estado_idx" ON "episodios_faturacao"("estado");

-- AddForeignKey
ALTER TABLE "fichas_pessoais_doente" ADD CONSTRAINT "fichas_pessoais_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pessoais_doente" ADD CONSTRAINT "fichas_pessoais_doente_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_episodioFaturacaoId_fkey" FOREIGN KEY ("episodioFaturacaoId") REFERENCES "episodios_faturacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_episodioFaturacaoId_fkey" FOREIGN KEY ("episodioFaturacaoId") REFERENCES "episodios_faturacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
