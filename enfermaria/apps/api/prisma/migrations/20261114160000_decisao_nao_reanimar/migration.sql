-- AlterTable
ALTER TABLE "doentes" ADD COLUMN     "decisaoNaoReanimar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "decisaoNaoReanimarEm" TIMESTAMP(3),
ADD COLUMN     "decisaoNaoReanimarNotas" VARCHAR(1000),
ADD COLUMN     "decisaoNaoReanimarPorId" TEXT;

