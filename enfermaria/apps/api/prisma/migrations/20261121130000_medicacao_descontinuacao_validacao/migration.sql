-- QA-14: quem descontinuou uma prescrição e porquê.
ALTER TABLE "medicacoes" ADD COLUMN "descontinuadoPorId" TEXT;
ALTER TABLE "medicacoes" ADD COLUMN "motivoDescontinuacao" VARCHAR(500);
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_descontinuadoPorId_fkey" FOREIGN KEY ("descontinuadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- QA-15: justificação de uma administração antes da validação farmacêutica.
ALTER TABLE "registos_medicacao" ADD COLUMN "justificacaoNaoValidada" VARCHAR(500);
