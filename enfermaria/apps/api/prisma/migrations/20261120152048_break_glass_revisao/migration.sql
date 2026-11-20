-- AlterTable
ALTER TABLE "break_glass_access" ADD COLUMN     "escaladoEm" TIMESTAMP(3),
ADD COLUMN     "revisaoNota" TEXT,
ADD COLUMN     "revisaoResultado" TEXT,
ADD COLUMN     "revistoEm" TIMESTAMP(3),
ADD COLUMN     "revistoPorId" TEXT;

-- CreateIndex
CREATE INDEX "break_glass_access_revistoEm_criadoEm_idx" ON "break_glass_access"("revistoEm", "criadoEm");

-- CreateIndex
CREATE INDEX "break_glass_access_revistoPorId_idx" ON "break_glass_access"("revistoPorId");

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_revistoPorId_fkey" FOREIGN KEY ("revistoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

