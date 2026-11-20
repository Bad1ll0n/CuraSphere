-- AlterTable
ALTER TABLE "fichas_pessoais_doente" ADD COLUMN     "nifBusca" TEXT;

-- CreateIndex
CREATE INDEX "fichas_pessoais_doente_nifBusca_idx" ON "fichas_pessoais_doente"("nifBusca");

