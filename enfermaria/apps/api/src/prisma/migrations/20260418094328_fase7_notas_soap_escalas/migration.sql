-- CreateEnum
CREATE TYPE "TipoEscalaClinica" AS ENUM ('RASS', 'CPOT', 'SOFA', 'CTG', 'Apgar', 'PEWS', 'FLACC');

-- CreateTable
CREATE TABLE "notas_clinicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "subjetivo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "avaliacao" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadaEm" TIMESTAMP(3),

    CONSTRAINT "notas_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas_clinicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "tipo" "TipoEscalaClinica" NOT NULL,
    "valores" JSONB NOT NULL,
    "pontuacao" INTEGER,
    "classificacao" TEXT,
    "observacoes" TEXT,
    "registadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalas_clinicas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
