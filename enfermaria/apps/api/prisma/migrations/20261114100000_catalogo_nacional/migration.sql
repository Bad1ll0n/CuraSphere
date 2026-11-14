-- AlterTable
ALTER TABLE "catalogo_medicamentos" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "codigoCHNM" TEXT,
ADD COLUMN     "embalagem" TEXT,
ADD COLUMN     "fonte" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "versaoFonte" TEXT,
ADD COLUMN     "via" TEXT;

-- AlterTable
ALTER TABLE "medicacoes" ADD COLUMN     "catalogoId" TEXT,
ADD COLUMN     "codigoATC" TEXT,
ADD COLUMN     "dci" TEXT,
ADD COLUMN     "foraCatalogo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "justificacaoForaCatalogo" VARCHAR(1000),
ADD COLUMN     "overrideDuplicacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideDuplicacaoMotivo" VARCHAR(1000),
ADD COLUMN     "overrideInteracao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideInteracaoMotivo" VARCHAR(1000);

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_medicamentos_codigoCHNM_key" ON "catalogo_medicamentos"("codigoCHNM");

-- CreateIndex
CREATE INDEX "catalogo_medicamentos_dci_idx" ON "catalogo_medicamentos"("dci");

-- CreateIndex
CREATE INDEX "catalogo_medicamentos_codigoATC_idx" ON "catalogo_medicamentos"("codigoATC");

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_medicamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

