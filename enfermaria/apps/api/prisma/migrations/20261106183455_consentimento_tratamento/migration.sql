-- CreateTable
CREATE TABLE "consentimentos_tratamento" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "observacoes" TEXT,
    "registadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registadoPorId" TEXT,
    "revogadoEm" TIMESTAMP(3),
    "revogadoPorId" TEXT,
    "origemRevogacao" TEXT,

    CONSTRAINT "consentimentos_tratamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentimentos_tratamento_doenteId_finalidade_registadoEm_idx" ON "consentimentos_tratamento"("doenteId", "finalidade", "registadoEm");

-- AddForeignKey
ALTER TABLE "consentimentos_tratamento" ADD CONSTRAINT "consentimentos_tratamento_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_tratamento" ADD CONSTRAINT "consentimentos_tratamento_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_tratamento" ADD CONSTRAINT "consentimentos_tratamento_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
