-- Add tipoVisita field to doentes
ALTER TABLE "doentes" ADD COLUMN "tipoVisita" TEXT;

-- Retroactively set tipoVisita for existing internados
UPDATE "doentes" SET "tipoVisita" = 'internamento' WHERE "estadoRegisto" = 'internado' OR "estadoRegisto" = 'pendente_cama';
