-- UX-17 — prescrição estruturada: dose em valor + unidade, indicação e duração.
ALTER TABLE "medicacoes" ADD COLUMN "doseValor" DOUBLE PRECISION;
ALTER TABLE "medicacoes" ADD COLUMN "doseUnidade" TEXT;
ALTER TABLE "medicacoes" ADD COLUMN "indicacao" VARCHAR(300);
ALTER TABLE "medicacoes" ADD COLUMN "duracaoDias" INTEGER;
ALTER TABLE "medicacoes" ADD COLUMN "dataFimPrevista" TIMESTAMP(3);

-- A unidade é uma lista fechada (libs/shared/src/lib/dominios.ts), como os outros domínios (ARQ-22).
ALTER TABLE "medicacoes" ADD CONSTRAINT "ck_medicacoes_doseunidade" CHECK ("doseUnidade" IN ('mg', 'g', 'mcg', 'UI', 'ml', 'mEq', 'mmol', 'comp', 'cáps', 'gotas', 'puff', 'inalação', 'saqueta', 'ampola', 'un', 'aplicação')) NOT VALID;
ALTER TABLE "medicacoes" ADD CONSTRAINT "ck_medicacoes_dosevalor" CHECK ("doseValor" IS NULL OR "doseValor" > 0) NOT VALID;
ALTER TABLE "medicacoes" ADD CONSTRAINT "ck_medicacoes_duracaodias" CHECK ("duracaoDias" IS NULL OR "duracaoDias" BETWEEN 1 AND 365) NOT VALID;
