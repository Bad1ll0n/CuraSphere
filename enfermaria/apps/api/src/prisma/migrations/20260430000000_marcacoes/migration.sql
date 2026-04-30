-- AlterTable: add booking fields to Consulta
ALTER TABLE "consultas" ADD COLUMN "codigo" TEXT;
ALTER TABLE "consultas" ADD COLUMN "checkinEm" TIMESTAMP(3);

-- CreateIndex for consultas
CREATE UNIQUE INDEX "consultas_codigo_key" ON "consultas"("codigo");
CREATE INDEX "consultas_medicoId_dataHora_idx" ON "consultas"("medicoId", "dataHora");
CREATE INDEX "consultas_codigo_idx" ON "consultas"("codigo");

-- CreateTable: AgendaMedico
CREATE TABLE "agenda_medico" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "duracaoSlot" INTEGER NOT NULL DEFAULT 20,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_medico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for agenda_medico
CREATE UNIQUE INDEX "agenda_medico_medicoId_diaSemana_key" ON "agenda_medico"("medicoId", "diaSemana");

-- AddForeignKey
ALTER TABLE "agenda_medico" ADD CONSTRAINT "agenda_medico_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
