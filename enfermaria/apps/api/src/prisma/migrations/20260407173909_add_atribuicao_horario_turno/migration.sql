-- CreateTable
CREATE TABLE "atribuicoes_horario_turno" (
    "id" TEXT NOT NULL,
    "horarioTurnoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "atribuidoPorId" TEXT NOT NULL,

    CONSTRAINT "atribuicoes_horario_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atribuicoes_horario_turno_horarioTurnoId_doenteId_utilizado_key" ON "atribuicoes_horario_turno"("horarioTurnoId", "doenteId", "utilizadorId");

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_horarioTurnoId_fkey" FOREIGN KEY ("horarioTurnoId") REFERENCES "horarios_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_atribuidoPorId_fkey" FOREIGN KEY ("atribuidoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
