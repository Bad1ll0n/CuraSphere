-- CreateTable
CREATE TABLE "avaliacoes_risco" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "itens" JSONB NOT NULL,
    "risco" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_risco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sumarios_alta" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "motivoAlta" TEXT NOT NULL,
    "destino" TEXT,
    "resumoClinical" TEXT NOT NULL,
    "prescricaoSaida" TEXT,
    "medicoFamilia" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sumarios_alta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sumarios_alta_doenteId_key" ON "sumarios_alta"("doenteId");

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
