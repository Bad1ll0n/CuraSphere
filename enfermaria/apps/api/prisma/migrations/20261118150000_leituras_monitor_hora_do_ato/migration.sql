
-- AlterTable
ALTER TABLE "dispositivos_fhir" ADD COLUMN     "camaId" TEXT;

-- AlterTable
ALTER TABLE "dispositivos_monitor" ADD COLUMN     "camaId" TEXT;

-- AlterTable
ALTER TABLE "registos_medicacao" ADD COLUMN     "registadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sinais_vitais" ADD COLUMN     "dispositivoId" TEXT,
ADD COLUMN     "registadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "leituras_monitor" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "medidoEm" TIMESTAMP(3) NOT NULL,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valores" JSONB NOT NULL,
    "critica" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "validadaPorId" TEXT,
    "validadaEm" TIMESTAMP(3),
    "motivoRejeicao" VARCHAR(500),
    "sinalVitalId" TEXT,

    CONSTRAINT "leituras_monitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leituras_monitor_doenteId_estado_medidoEm_idx" ON "leituras_monitor"("doenteId", "estado", "medidoEm");

-- AddForeignKey
ALTER TABLE "leituras_monitor" ADD CONSTRAINT "leituras_monitor_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_monitor" ADD CONSTRAINT "leituras_monitor_validadaPorId_fkey" FOREIGN KEY ("validadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- PROD-16: nos registos que já existiam, a hora do registo era a do ato (não havia outra).
UPDATE "registos_medicacao" SET "registadoEm" = "administradoEm";
UPDATE "sinais_vitais" SET "registadoEm" = "data";
