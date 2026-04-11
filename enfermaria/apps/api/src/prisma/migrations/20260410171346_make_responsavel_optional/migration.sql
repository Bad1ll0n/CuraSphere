-- DropForeignKey
ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_responsavelId_fkey";

-- AlterTable
ALTER TABLE "tarefas" ALTER COLUMN "responsavelId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
