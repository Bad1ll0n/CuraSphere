#!/bin/sh
# Restauro da base de dados CuraSphere a partir de um backup gerado por backup-db.sh
# Uso: ./scripts/restore-db.sh [caminho/para/backup.sql.gz]
#   Sem argumento: usa o backup .sql.gz mais recente em ./backups
# Requer: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (ou .env.prod)
#
# ATENÇÃO: operação destrutiva — sobrescreve a base de dados alvo (DB_NAME/DB_HOST).
# NUNCA correr contra produção sem confirmar o alvo primeiro (ex.: aponta DB_HOST
# para uma base de dados de staging/scratch). Este script deve ser testado
# periodicamente contra uma base de dados de staging/scratch (ex.: como parte de
# um drill de disaster recovery), não apenas escrito e esquecido — um backup
# nunca testado é uma esperança, não um backup.

set -e

BACKUP_DIR="./backups"
FILENAME="$1"

if [ -z "$FILENAME" ]; then
  FILENAME=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -n 1)
  if [ -z "$FILENAME" ]; then
    echo "[$(date)] ERRO: nenhum backup .sql.gz encontrado em ${BACKUP_DIR} e nenhum ficheiro indicado como argumento." >&2
    exit 1
  fi
  echo "[$(date)] Nenhum ficheiro indicado — a usar o backup mais recente: $FILENAME"
fi

if [ ! -f "$FILENAME" ]; then
  echo "[$(date)] ERRO: ficheiro de backup não encontrado: $FILENAME" >&2
  exit 1
fi

TARGET_HOST="${DB_HOST:-localhost}"
TARGET_PORT="${DB_PORT:-5432}"
TARGET_USER="${DB_USER:-postgres}"
TARGET_DB="${DB_NAME:-enfermaria}"

echo "=============================================================="
echo "  RESTAURO DESTRUTIVO DE BASE DE DADOS"
echo "=============================================================="
echo "  Ficheiro de backup: $FILENAME"
echo "  Base de dados alvo: $TARGET_DB"
echo "  Host:porta alvo:    $TARGET_HOST:$TARGET_PORT"
echo "  Utilizador:         $TARGET_USER"
echo ""
echo "  Isto vai SOBRESCREVER os dados atuais em '$TARGET_DB'."
echo "  Confirma que o alvo acima é o pretendido (idealmente uma base"
echo "  de dados de staging/scratch, não produção sem plano de rollback)."
echo "=============================================================="

# Confirmação interativa — operação destrutiva, nunca correr sem confirmação explícita.
printf "Escreve 'sim' para continuar com o restauro: "
read -r CONFIRMACAO
if [ "$CONFIRMACAO" != "sim" ]; then
  echo "[$(date)] Restauro cancelado pelo utilizador."
  exit 1
fi

echo "[$(date)] A iniciar restauro de '$FILENAME' para '$TARGET_DB'..."

PGPASSWORD="${DB_PASSWORD:-postgres}" \
  gunzip -c "$FILENAME" \
  | psql \
      -h "$TARGET_HOST" \
      -p "$TARGET_PORT" \
      -U "$TARGET_USER" \
      -d "$TARGET_DB" \
      --set ON_ERROR_STOP=1

echo "[$(date)] Restauro concluído com sucesso para '$TARGET_DB'."
