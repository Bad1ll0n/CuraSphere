-- PROD-01 — correcção de dados, idempotente. Correr uma vez após o deploy.
-- Antes da correcção, `admitir()` criava o doente com cama mas deixava o default do schema
-- (`pendente_cama`): o doente ficava fora da lista clínica, da cozinha e dos indicadores.
-- Um doente activo com cama atribuída está, por definição, internado.
UPDATE doentes
   SET "estadoRegisto" = 'internado'
 WHERE "estadoRegisto" = 'pendente_cama'
   AND "camaId" IS NOT NULL
   AND ativo = true;
