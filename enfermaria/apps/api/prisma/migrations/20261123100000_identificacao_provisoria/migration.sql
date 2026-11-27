-- UX-23: utente não identificado à entrada (identificação provisória, fundida depois).
ALTER TABLE "doentes" ADD COLUMN "identificacaoProvisoria" BOOLEAN NOT NULL DEFAULT false;
