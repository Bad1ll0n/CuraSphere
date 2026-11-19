-- AlterTable
ALTER TABLE "eventos_adversos" ADD COLUMN     "anonimo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "classeIcps" TEXT,
ADD COLUMN     "exportadoNotificaEm" TIMESTAMP(3);


-- PROD-18: os eventos que já existiam ganham a classe ICPS correspondente ao tipo.
UPDATE "eventos_adversos" SET "classeIcps" = CASE "tipo"
  WHEN 'queda' THEN 'acidente_doente'
  WHEN 'erro_medicacao' THEN 'medicacao_fluidos'
  WHEN 'infecao' THEN 'infecao_associada'
  WHEN 'lesao_pressao' THEN 'processo_clinico'
  ELSE NULL END
WHERE "classeIcps" IS NULL;
