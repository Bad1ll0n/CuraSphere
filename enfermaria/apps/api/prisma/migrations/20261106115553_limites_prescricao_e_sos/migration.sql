-- AlterTable
ALTER TABLE "medicacoes" ADD COLUMN     "intervaloMinimoH" INTEGER,
ADD COLUMN     "maxDosesDia" INTEGER,
ADD COLUMN     "overrideDose" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideDoseMotivo" VARCHAR(1000);

-- AlterTable
ALTER TABLE "registos_medicacao" ADD COLUMN     "justificacaoSOS" VARCHAR(500);
