-- PROD-24: o nome da coluna tinha duas letras cirílicas («и», «л»): quem o escrevia com letras
-- latinas lia em silêncio `undefined`. Renomeia sem perder dados.
ALTER TABLE "planos_alta" RENAME COLUMN "afebrилApenas24h" TO "afebril24h";
