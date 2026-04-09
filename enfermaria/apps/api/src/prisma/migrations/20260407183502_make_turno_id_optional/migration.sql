-- DropForeignKey
ALTER TABLE "notas_turno" DROP CONSTRAINT "notas_turno_turnoId_fkey";

-- DropForeignKey
ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_turnoId_fkey";

-- AlterTable
ALTER TABLE "notas_turno" ALTER COLUMN "turnoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tarefas" ALTER COLUMN "turnoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
