-- PERF-15: estatísticas por query (o Postgres de produção carrega a biblioteca em
-- shared_preload_libraries; ver docker-compose.prod.yml). Sem privilégios para criar a extensão
-- (BD gerida, utilizador sem superuser), a migração não falha — fica um aviso e cria-se à mão.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'pg_stat_statements não criada (sem privilégios) — criar com um superutilizador: CREATE EXTENSION pg_stat_statements;';
END
$$;
