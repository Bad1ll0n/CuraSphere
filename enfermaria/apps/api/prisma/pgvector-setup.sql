-- pgvector setup script — run once per PostgreSQL instance when pgvector is installed
-- Requires: pgvector extension (https://github.com/pgvector/pgvector)
-- Install: apt-get install postgresql-17-pgvector  OR  brew install pgvector

-- 1. Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to guidelines_clinicas
ALTER TABLE guidelines_clinicas
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. HNSW index for approximate nearest-neighbour search (cosine distance)
CREATE INDEX IF NOT EXISTS guidelines_embedding_hnsw_idx
  ON guidelines_clinicas
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- After running this script, the GuidelinesService will automatically
-- detect the pgvector column and use vector similarity search instead
-- of the JavaScript cosine fallback (no code changes required).
