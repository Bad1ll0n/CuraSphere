-- Pesquisa full-text com similaridade trigram (pg_trgm)
-- Pode ser executado múltiplas vezes sem efeito (IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN no nome do doente (pesquisa insensível a maiúsculas)
CREATE INDEX IF NOT EXISTS idx_doente_nome_trgm
  ON "Doente" USING gin (nome gin_trgm_ops);

-- Índices GIN no catálogo de medicamentos
CREATE INDEX IF NOT EXISTS idx_catalogo_dci_trgm
  ON "CatalogoMedicamento" USING gin (dci gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_catalogo_marca_trgm
  ON "CatalogoMedicamento" USING gin ("nomeMarca" gin_trgm_ops);
