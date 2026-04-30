-- Make camaId optional on doentes
ALTER TABLE "doentes" ALTER COLUMN "camaId" DROP NOT NULL;

-- Make administrativoAdmissaoId optional
ALTER TABLE "doentes" ALTER COLUMN "administrativoAdmissaoId" DROP NOT NULL;

-- Make dataNascimento optional
ALTER TABLE "doentes" ALTER COLUMN "dataNascimento" DROP NOT NULL;

-- Make diagnosticoPrincipal optional
ALTER TABLE "doentes" ALTER COLUMN "diagnosticoPrincipal" DROP NOT NULL;

-- Add estadoRegisto field
ALTER TABLE "doentes" ADD COLUMN "estadoRegisto" TEXT NOT NULL DEFAULT 'pendente_cama';

-- Retroactively mark existing patients with a bed as 'internado'
UPDATE "doentes" SET "estadoRegisto" = 'internado' WHERE "camaId" IS NOT NULL;
