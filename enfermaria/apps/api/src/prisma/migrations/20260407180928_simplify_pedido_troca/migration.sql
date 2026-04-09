/*
  Warnings:

  - You are about to drop the column `turnoDestinatarioId` on the `pedidos_troca_turno` table. All the data in the column will be lost.
  - You are about to drop the column `turnoSolicitanteId` on the `pedidos_troca_turno` table. All the data in the column will be lost.
  - Added the required column `turnoId` to the `pedidos_troca_turno` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pedidos_troca_turno" DROP CONSTRAINT "pedidos_troca_turno_turnoDestinatarioId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_troca_turno" DROP CONSTRAINT "pedidos_troca_turno_turnoSolicitanteId_fkey";

-- AlterTable
ALTER TABLE "pedidos_troca_turno" DROP COLUMN "turnoDestinatarioId",
DROP COLUMN "turnoSolicitanteId",
ADD COLUMN     "turnoId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "horarios_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
