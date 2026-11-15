-- AlterTable
ALTER TABLE "catalogo_medicamentos" ADD COLUMN     "gtin" TEXT;

-- AlterTable
ALTER TABLE "registos_medicacao" ADD COLUMN     "leituraExcecao" VARCHAR(500),
ADD COLUMN     "leituraMedicamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leituraPulseira" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loteLido" TEXT,
ADD COLUMN     "validadeLida" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_medicamentos_gtin_key" ON "catalogo_medicamentos"("gtin");

