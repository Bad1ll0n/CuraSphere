-- CreateTable
CREATE TABLE "sinais_vitais" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pressaoSistolica" INTEGER,
    "pressaoDiastolica" INTEGER,
    "pulso" INTEGER,
    "temperatura" DOUBLE PRECISION,
    "saturacaoO2" INTEGER,
    "frequenciaRespiratoria" INTEGER,
    "peso" DOUBLE PRECISION,
    "notas" TEXT,

    CONSTRAINT "sinais_vitais_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
