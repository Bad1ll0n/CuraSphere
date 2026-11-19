-- DropIndex
DROP INDEX "escalas_mes_ano_key";

-- AlterTable
ALTER TABLE "escalas" ADD COLUMN     "servico" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "competencias" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unidade" TEXT;

-- CreateTable
CREATE TABLE "parametros_dotacao" (
    "id" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "horasPorCategoria" JSONB NOT NULL,
    "distribuicaoTurno" JSONB NOT NULL,
    "horasEfetivasTurno" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "minimos" JSONB NOT NULL,
    "horasSemanaisMax" INTEGER NOT NULL DEFAULT 40,
    "competenciaObrigatoria" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "parametros_dotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_dotacao" (
    "id" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "doentes" INTEGER NOT NULL,
    "porCategoria" JSONB NOT NULL,
    "horasNecessarias" DOUBLE PRECISION NOT NULL,
    "horasDisponiveis" DOUBLE PRECISION NOT NULL,
    "enfermeiros" INTEGER NOT NULL,
    "racio" DOUBLE PRECISION,
    "semaforo" TEXT NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registos_dotacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametros_dotacao_servico_key" ON "parametros_dotacao"("servico");

-- CreateIndex
CREATE INDEX "registos_dotacao_servico_data_idx" ON "registos_dotacao"("servico", "data");

-- CreateIndex
CREATE UNIQUE INDEX "registos_dotacao_servico_data_turno_key" ON "registos_dotacao"("servico", "data", "turno");

-- CreateIndex
CREATE UNIQUE INDEX "escalas_mes_ano_servico_key" ON "escalas"("mes", "ano", "servico");

