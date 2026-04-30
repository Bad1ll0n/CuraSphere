-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "letra" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aguarda',
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "balcao" TEXT,
    "nomeUtente" TEXT,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_estado_criadoEm_idx" ON "tickets"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "tickets_tipo_criadoEm_idx" ON "tickets"("tipo", "criadoEm");
