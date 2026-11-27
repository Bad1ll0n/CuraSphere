#!/bin/sh
# OPS-02 — ensaio automático de recuperação para um instante (PITR), ponta a ponta, em
# contentores descartáveis. Não toca em nenhuma base real.
#
#   1. PostgreSQL com o MESMO arquivo de WAL de produção (scripts/arquivar-wal.sh);
#   2. dados sintéticos (ENSAIO_LINHAS) e base backup CIFRADO (scripts/basebackup.sh);
#   3. escritas antes de um instante T e depois de T;
#   4. restauro até T com scripts/restaurar-pitr.sh;
#   5. prova: o que foi escrito antes de T está lá, o que veio depois NÃO está;
#   6. imprime o RPO observado e o RTO medido.
#
# Uso: ./scripts/ensaio-pitr.sh          (ENSAIO_LINHAS=200000 por omissão)
# Requer: docker, openssl (para a cifra do ensaio). Corre em CI (workflow ensaio-dr.yml).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
IMAGEM_PG="${IMAGEM_PG:-postgres:16-alpine@sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139}"
LINHAS="${ENSAIO_LINHAS:-200000}"
ID="ensaio-pitr-$$"
REDE="$ID"; DB="$ID-db"
V_DADOS="$ID-dados"; V_WAL="$ID-wal"; V_SCRIPTS="$ID-scripts"; V_BACKUPS="$ID-backups"
V_RESTAURADO="$ID-restaurado"
export BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
SAIDA=$(mktemp -d)

limpar() {
  docker rm -f "$DB" "$ID-verif" >/dev/null 2>&1 || true
  docker volume rm "$V_DADOS" "$V_WAL" "$V_SCRIPTS" "$V_BACKUPS" "$V_RESTAURADO" >/dev/null 2>&1 || true
  docker network rm "$REDE" >/dev/null 2>&1 || true
  rm -rf "$SAIDA"
}
trap limpar EXIT

psql_db() { docker exec "$DB" psql -U postgres -d ensaio -v ON_ERROR_STOP=1 -tAc "$1"; }

echo "== Ensaio PITR ($LINHAS linhas) =="
docker network create "$REDE" >/dev/null
for v in "$V_DADOS" "$V_WAL" "$V_SCRIPTS" "$V_BACKUPS"; do docker volume create "$v" >/dev/null; done
# Scripts e pg_hba.conf entram por stdin (sem bind mounts: igual em Linux, CI e Docker Desktop).
tar -C "$SCRIPT_DIR/.." -cf - scripts postgres | docker run -i --rm -v "$V_SCRIPTS":/s --entrypoint tar "$IMAGEM_PG" -xf - -C /s

echo "[1/6] PostgreSQL com arquivo de WAL (como em produção)..."
docker run -d --name "$DB" --network "$REDE" -e POSTGRES_PASSWORD=ensaio -e POSTGRES_DB=ensaio \
  -v "$V_DADOS":/var/lib/postgresql/data -v "$V_WAL":/wal-arquivo -v "$V_SCRIPTS":/repo:ro \
  --entrypoint sh "$IMAGEM_PG" -c '
    mkdir -p /wal-arquivo && chown postgres:postgres /wal-arquivo
    exec docker-entrypoint.sh postgres -c hba_file=/repo/postgres/pg_hba.conf \
      -c wal_level=replica -c archive_mode=on -c archive_timeout=60 \
      -c "archive_command=/repo/scripts/arquivar-wal.sh %p %f"' >/dev/null
for _ in $(seq 1 60); do psql_db 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done

echo "[2/6] Dados sintéticos e base backup cifrado..."
psql_db "CREATE TABLE registo (id bigserial PRIMARY KEY, fase text NOT NULL, criado timestamptz DEFAULT now(), dados text)"
psql_db "INSERT INTO registo (fase, dados) SELECT 'base', md5(g::text) FROM generate_series(1, $LINHAS) g"
docker run --rm --network "$REDE" -v "$V_BACKUPS":/backups -v "$V_SCRIPTS":/repo:ro \
  -e POSTGRES_HOST="$DB" -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=ensaio \
  -e BACKUP_ENCRYPTION_KEY -e BACKUP_DIR=/backups -e METRICAS_DIR=/nao-existe \
  --entrypoint sh "$IMAGEM_PG" -c 'apk add --no-cache openssl >/dev/null 2>&1; /repo/scripts/basebackup.sh'

echo "[3/6] Escritas antes e depois do instante T..."
psql_db "INSERT INTO registo (fase) SELECT 'antes' FROM generate_series(1, 500)"
sleep 2
T=$(psql_db "SELECT now()")
sleep 2
psql_db "INSERT INTO registo (fase) SELECT 'depois' FROM generate_series(1, 300)"
psql_db "SELECT pg_switch_wal()" >/dev/null
# Espera que o segmento com as escritas de 'depois' esteja arquivado.
ULTIMO=$(psql_db "SELECT pg_walfile_name(pg_current_wal_lsn())")
for _ in $(seq 1 60); do
  docker exec "$DB" sh -c "ls /wal-arquivo" | grep -q . && \
    [ "$(psql_db "SELECT last_archived_wal >= '$ULTIMO' FROM pg_stat_archiver")" = "t" ] && break
  psql_db "SELECT pg_switch_wal()" >/dev/null; sleep 1
done
echo "      T = $T"

echo "[4/6] Desastre: a base original deixa de existir..."
docker rm -f "$DB" >/dev/null

echo "[5/6] Restauro até T (scripts/restaurar-pitr.sh)..."
mkdir -p "$SAIDA/wal"
docker run --rm -v "$V_WAL":/w:ro --entrypoint tar "$IMAGEM_PG" -cf - -C /w . | tar -xf - -C "$SAIDA/wal"
BASE_NOME=$(docker run --rm -v "$V_BACKUPS":/b:ro --entrypoint sh "$IMAGEM_PG" -c 'ls /b | grep "^base_" | head -1')
docker run --rm -v "$V_BACKUPS":/b:ro --entrypoint cat "$IMAGEM_PG" "/b/$BASE_NOME" > "$SAIDA/$BASE_NOME"
INICIO=$(date +%s)
DB_USER=postgres VOLUME_DESTINO="$V_RESTAURADO" IMAGEM_PG="$IMAGEM_PG" \
  "$SCRIPT_DIR/restaurar-pitr.sh" "$SAIDA/$BASE_NOME" "$SAIDA/wal" "$T"
RTO=$(( $(date +%s) - INICIO ))

echo "[6/6] Verificação..."
docker run -d --name "$ID-verif" -v "$V_RESTAURADO":/var/lib/postgresql/data "$IMAGEM_PG" >/dev/null
for _ in $(seq 1 60); do docker exec "$ID-verif" psql -U postgres -d ensaio -tAc 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
CONTAGEM=$(docker exec "$ID-verif" psql -U postgres -d ensaio -tAc "SELECT string_agg(fase || '=' || n, ' ' ORDER BY fase) FROM (SELECT fase, count(*) n FROM registo GROUP BY fase) x")
echo "      Restaurado: $CONTAGEM"

ESPERADO="antes=500 base=$LINHAS"
if [ "$CONTAGEM" != "$ESPERADO" ]; then
  echo "FALHOU: esperado '$ESPERADO' (sem nenhum 'depois'), obtido '$CONTAGEM'." >&2
  exit 1
fi
echo "OK: estado exacto em T — as $LINHAS linhas base e as 500 'antes' estão lá; as 300 'depois' não."
echo "RTO medido (restauro + recuperação, $LINHAS linhas): ${RTO} s"
