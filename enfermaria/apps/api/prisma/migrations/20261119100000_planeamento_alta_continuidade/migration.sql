-- AlterTable
ALTER TABLE "planos_alta" ADD COLUMN     "altaClinicaEm" TIMESTAMP(3),
ADD COLUMN     "altaClinicaPorId" TEXT;

-- CreateTable
CREATE TABLE "referenciacoes_continuidade" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "episodioId" TEXT,
    "destino" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'proposta',
    "motivo" VARCHAR(1000) NOT NULL,
    "nota" VARCHAR(1000),
    "criadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "aceiteEm" TIMESTAMP(3),
    "vagaEm" TIMESTAMP(3),
    "fechadaEm" TIMESTAMP(3),
    "historico" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "referenciacoes_continuidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ensinos_doente" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "episodioId" TEXT,
    "tema" TEXT NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "destinatario" TEXT NOT NULL,
    "cuidadorNome" VARCHAR(200),
    "compreensao" TEXT NOT NULL,
    "nota" VARCHAR(1000),
    "realizadoPorId" TEXT NOT NULL,
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ensinos_doente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referenciacoes_continuidade_doenteId_episodioId_idx" ON "referenciacoes_continuidade"("doenteId", "episodioId");

-- CreateIndex
CREATE INDEX "referenciacoes_continuidade_estado_idx" ON "referenciacoes_continuidade"("estado");

-- CreateIndex
CREATE INDEX "ensinos_doente_doenteId_episodioId_idx" ON "ensinos_doente"("doenteId", "episodioId");

-- AddForeignKey
ALTER TABLE "referenciacoes_continuidade" ADD CONSTRAINT "referenciacoes_continuidade_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referenciacoes_continuidade" ADD CONSTRAINT "referenciacoes_continuidade_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensinos_doente" ADD CONSTRAINT "ensinos_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensinos_doente" ADD CONSTRAINT "ensinos_doente_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

