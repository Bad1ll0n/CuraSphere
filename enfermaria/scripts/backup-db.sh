#!/bin/sh
# Backup manual da base de dados CuraSphere
# Uso: ./scripts/backup-db.sh
# Requer: DB_USER, DB_PASSWORD, DB_HOST, DB_NAME (ou .env.prod). BACKUP_DIR opcional.

set -eu

# BACKUP_DIR vem do ambiente: `backup-all.sh` exporta-o, e no contentor `backup` o compose
# define-o como o volume montado. Um caminho relativo fixo dependia do directório de
# trabalho de quem chamava — e o do cron não é o volume.
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
PARCIAL="${FILENAME}.parcial"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"

mkdir -p "$BACKUP_DIR"

# Um backup interrompido nunca pode ficar com o nome de um backup bom.
trap 'rm -f "$PARCIAL"' EXIT

# OPS-04: sem `--clean --if-exists` o dump so se consegue repor numa base VAZIA — e a
# base a repor num desastre real nunca esta vazia (o Postgres cria-a ja com o schema
# `public`, ou tem restos de uma tentativa anterior). Sem `--no-owner --no-acl`, o
# restauro falha se o utilizador de recuperacao nao for o dono original dos objectos.
# Um backup que nao se consegue repor nao e um backup.
#
# OPS-08: era `pg_dump | gzip > ficheiro`. Num pipe, o shell só olha para o código de saída
# do ÚLTIMO comando: com o `pg_dump` a falhar — password errada, base em baixo, disco cheio
# a meio — o `gzip` terminava bem e ficava escrito um `.sql.gz` válido e incompleto. O log
# dizia "Backup concluído" e a retenção ia apagando os backups bons por cima dele.
# `set -o pipefail` não é POSIX e este script corre em `sh`: o `pg_dump` passa a comprimir
# ele próprio (-Z), e o código de saída que conta é o dele.
echo "[$(date)] A iniciar backup da base de dados..."

PGPASSWORD="${DB_PASSWORD:-postgres}" \
  pg_dump \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-postgres}" \
    --clean --if-exists \
    --no-owner --no-acl \
    -Z 6 \
    -f "$PARCIAL" \
    "${DB_NAME:-enfermaria}"

# Verificado antes de o ficheiro ganhar o nome definitivo, e não no dia em que for preciso
# repô-lo: o arquivo tem de descomprimir, e o dump tem de terminar na marca que o próprio
# pg_dump escreve quando chega ao fim.
if ! gzip -t "$PARCIAL" 2>/dev/null; then
  echo "[$(date)] ERRO: o arquivo comprimido está corrompido. Backup NÃO concluído." >&2
  exit 1
fi
if ! gzip -dc "$PARCIAL" | tail -n 20 | grep -q 'PostgreSQL database dump complete'; then
  echo "[$(date)] ERRO: o dump termina a meio (falta a marca final do pg_dump). Backup NÃO concluído." >&2
  exit 1
fi

mv "$PARCIAL" "$FILENAME"
SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date)] Backup concluído e verificado: $FILENAME ($SIZE)"

# A retenção só corre depois de um backup bom: com o `set -e`, uma falha acima termina o
# script antes de chegar aqui, e os backups antigos ficam onde estão.
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$RETENCAO_DIAS" -delete
echo "[$(date)] Backups antigos (>$RETENCAO_DIAS dias) removidos."

echo "[$(date)] Backups disponíveis:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (nenhum)"
