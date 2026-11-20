# Desempenho da base de dados (PERF-15)

## Configuração

O Postgres de produção (`docker-compose.prod.yml`, serviço `postgres`) arranca com parâmetros
para o limite de 2 GB do contentor. Antes usava os valores por omissão da imagem: 128 MB de
`shared_buffers` e custos de disco rotativo.

| Parâmetro | Valor | Variável (`.env.prod`) |
|---|---|---|
| `shared_buffers` | 512MB (¼ da memória) | `PG_SHARED_BUFFERS` |
| `effective_cache_size` | 1536MB (¾) | `PG_EFFECTIVE_CACHE_SIZE` |
| `work_mem` | 8MB por operação de ordenação/hash | `PG_WORK_MEM` |
| `maintenance_work_mem` | 128MB (VACUUM, índices) | `PG_MAINTENANCE_WORK_MEM` |
| `max_connections` | 150 (réplicas da API × `DB_POOL_MAX` + serviços) | `PG_MAX_CONNECTIONS` |
| `random_page_cost` / `effective_io_concurrency` | 1.1 / 200 (SSD) | — |
| `max_wal_size` / `checkpoint_completion_target` | 2GB / 0.9 | — |
| `idle_in_transaction_session_timeout` | 60s | — |
| `log_min_duration_statement` | 500 ms | `PG_LOG_LENTAS_MS` |
| `log_lock_waits`, `log_temp_files` | on, 10MB | — |
| `shm_size` (compose) | 256mb, para as queries paralelas | — |

Se o limite de memória do contentor mudar, ajustar as variáveis `PG_*` em proporção.

## Que queries pesam: `pg_stat_statements`

A biblioteca é carregada no arranque (`shared_preload_libraries`) e a extensão é criada por
migração. Numa BD gerida sem superutilizador, a migração deixa um aviso e a extensão cria-se à mão.

```sql
-- as 15 que mais tempo total consumiram desde o último reset
SELECT round(total_exec_time) AS ms_total, calls, round(mean_exec_time, 1) AS ms_media,
       rows, left(query, 120) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;

-- recomeçar a medição (ex.: depois de um deploy)
SELECT pg_stat_statements_reset();
```

No Grafana, o `postgres-exporter` (perfil `monitoring`) publica as 50 mais pesadas
(`pg_stat_statements_*`). As queries com mais de 500 ms aparecem no log do contentor
`curasphere-db` (Loki).

## Na aplicação

- **PERF-14:** o painel de carga do turno faz 4 consultas agrupadas por doente, em vez de 4 por
  doente.
- **PERF-16:** listas grandes com dados cifrados são decifradas por lotes, cedendo o event loop
  entre eles, para a API continuar a responder durante uma exportação. Nada se ordena pelo nome
  cifrado em SQL, porque a ordem seria aleatória; ordena-se depois de decifrar, como nos
  contactos de emergência, ou por campos em claro (data, cama, n.º de processo).
