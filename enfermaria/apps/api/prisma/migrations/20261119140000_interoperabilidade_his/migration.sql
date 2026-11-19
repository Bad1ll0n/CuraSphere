-- AlterTable
ALTER TABLE "doentes" ADD COLUMN     "identificadorHis" TEXT;

-- AlterTable
ALTER TABLE "hl7_mensagens" ADD COLUMN     "direcao" TEXT NOT NULL DEFAULT 'entrada',
ADD COLUMN     "doenteId" TEXT,
ADD COLUMN     "efeito" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "doentes_identificadorHis_key" ON "doentes"("identificadorHis");

