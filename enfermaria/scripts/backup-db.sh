#!/bin/sh
# Backup manual da base de dados CuraSphere
# Uso: ./scripts/backup-db.sh
# Requer: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_DB (ou .env.prod)

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
RETENCAO_DIAS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] A iniciar backup da base de dados..."

PGPASSWORD="${DB_PASSWORD:-postgres}" \
  pg_dump \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-postgres}" \
    "${DB_NAME:-enfermaria}" \
  | gzip > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date)] Backup concluído: $FILENAME ($SIZE)"

# Apagar backups com mais de RETENCAO_DIAS dias
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$RETENCAO_DIAS" -delete
echo "[$(date)] Backups antigos (>$RETENCAO_DIAS dias) removidos."

echo "[$(date)] Backups disponíveis:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (nenhum)"
