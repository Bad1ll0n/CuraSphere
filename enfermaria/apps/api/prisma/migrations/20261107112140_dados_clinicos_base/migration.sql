-- AlterTable
ALTER TABLE "alergias" ADD COLUMN     "certeza" TEXT,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "fonte" TEXT,
ADD COLUMN     "reacao" TEXT,
ADD COLUMN     "sistemaCodigo" TEXT,
ADD COLUMN     "verificadaEm" TIMESTAMP(3),
ADD COLUMN     "verificadaPorId" TEXT;

-- AlterTable
ALTER TABLE "avaliacoes_risco" ADD COLUMN     "proximaAvaliacaoEm" TIMESTAMP(3),
ADD COLUMN     "versao" TEXT;

-- AlterTable
ALTER TABLE "doentes" ADD COLUMN     "alturaCm" DOUBLE PRECISION,
ADD COLUMN     "alturaEm" TIMESTAMP(3),
ADD COLUMN     "avaliacaoAlergias" TEXT NOT NULL DEFAULT 'nao_avaliado',
ADD COLUMN     "avaliacaoAlergiasEm" TIMESTAMP(3),
ADD COLUMN     "avaliacaoAlergiasPorId" TEXT,
ADD COLUMN     "pesoReferenciaEm" TIMESTAMP(3),
ADD COLUMN     "pesoReferenciaFonte" TEXT,
ADD COLUMN     "pesoReferenciaKg" DOUBLE PRECISION,
ADD COLUMN     "sexo" TEXT;

-- AlterTable
ALTER TABLE "escalas_clinicas" ADD COLUMN     "versao" TEXT;

-- AlterTable
ALTER TABLE "registos_medicacao" ADD COLUMN     "reavaliarDorAte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sinais_vitais" ADD COLUMN     "dor" INTEGER,
ADD COLUMN     "escalaDor" TEXT,
ADD COLUMN     "proximaAvaliacaoEm" TIMESTAMP(3);

-- PROD-06: doentes que já têm alergias activas registadas ficam "com_alergias" (não "nao_avaliado").
UPDATE "doentes" d SET "avaliacaoAlergias" = 'com_alergias'
WHERE EXISTS (SELECT 1 FROM "alergias" a WHERE a."doenteId" = d."id" AND a."deletedAt" IS NULL);
