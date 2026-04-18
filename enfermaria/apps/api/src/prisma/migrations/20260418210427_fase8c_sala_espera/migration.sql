-- CreateEnum
CREATE TYPE "EstadoCheckin" AS ENUM ('aguardando', 'em_atendimento', 'atendido', 'desistiu', 'ausente');

-- CreateTable
CREATE TABLE "checkins_sala_espera" (
    "id" TEXT NOT NULL,
    "nomeDoente" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "numeroUtente" TEXT,
    "motivo" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 3,
    "estado" "EstadoCheckin" NOT NULL DEFAULT 'aguardando',
    "chegadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadoEm" TIMESTAMP(3),
    "atendidoEm" TIMESTAMP(3),
    "rececionistadoPorId" TEXT,
    "medicoId" TEXT,
    "observacoes" TEXT,

    CONSTRAINT "checkins_sala_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkins_sala_espera_estado_chegadaEm_idx" ON "checkins_sala_espera"("estado", "chegadaEm");

-- AddForeignKey
ALTER TABLE "checkins_sala_espera" ADD CONSTRAINT "checkins_sala_espera_rececionistadoPorId_fkey" FOREIGN KEY ("rececionistadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_sala_espera" ADD CONSTRAINT "checkins_sala_espera_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
