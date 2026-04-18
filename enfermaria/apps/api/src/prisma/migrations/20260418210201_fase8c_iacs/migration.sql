-- AlterTable
ALTER TABLE "doentes" ADD COLUMN     "emIsolamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoIsolamento" TEXT;
