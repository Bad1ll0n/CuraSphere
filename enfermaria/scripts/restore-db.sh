#!/bin/sh
# Restauro da base de dados CuraSphere a partir de um backup gerado por backup-db.sh
# Uso: ./scripts/restore-db.sh [caminho/para/backup.sql.gz[.age|.enc]]
#   Sem argumento: usa o backup mais recente em $BACKUP_DIR (./backups por omissão)
# Backups cifrados (OPS-01): .age precisa de BACKUP_AGE_IDENTITY (chave privada);
#   .enc precisa de BACKUP_ENCRYPTION_KEY. Ver scripts/backup-cifra.sh.
# Requer: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (ou .env.prod)
#
# ATENÇÃO: operação destrutiva — sobrescreve a base de dados alvo (DB_NAME/DB_HOST).
# NUNCA correr contra produção sem confirmar o alvo primeiro (ex.: aponta DB_HOST
# para uma base de dados de staging/scratch). Este script deve ser testado
# periodicamente contra uma base de dados de staging/scratch (ex.: como parte de
# um drill de disaster recovery), não apenas escrito e esquecido — um backup
# nunca testado é uma esperança, não um backup.

set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
FILENAME="${1:-}"

if [ -z "$FILENAME" ]; then
  FILENAME=$(ls -t "${BACKUP_DIR}"/backup_*.sql.gz* 2>/dev/null | grep -v '\.parcial$' | head -n 1)
  if [ -z "$FILENAME" ]; then
    echo "[$(date)] ERRO: nenhum backup encontrado em ${BACKUP_DIR} e nenhum ficheiro indicado como argumento." >&2
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

# Operacao destrutiva: por omissao exige confirmacao escrita.
#
# OPS-04: o modo nao-interactivo existe para o ensaio de recuperacao poder correr em
# CI ou por script — um runbook que so se consegue executar a mao nunca e ensaiado, e
# um restauro que nunca foi ensaiado nao e uma capacidade, e uma esperanca.
if [ "${RESTAURO_NAO_INTERATIVO:-}" = "sim" ]; then
  echo "[$(date)] Modo nao-interactivo: confirmacao dispensada por RESTAURO_NAO_INTERATIVO=sim."
else
  printf "Escreve 'sim' para continuar com o restauro: "
  read -r CONFIRMACAO
  if [ "$CONFIRMACAO" != "sim" ]; then
    echo "[$(date)] Restauro cancelado pelo utilizador."
    exit 1
  fi
fi

echo "[$(date)] A iniciar restauro de '$FILENAME' para '$TARGET_DB'..."

# Decifrar ANTES de mexer na base: com a chave errada, falha aqui e não a meio do restauro.
if ! backup_decifrar "$FILENAME" | gzip -t 2>/dev/null; then
  echo "[$(date)] ERRO: não foi possível decifrar/descomprimir $FILENAME (chave em falta ou errada?)." >&2
  exit 1
fi

backup_decifrar "$FILENAME" \
  | gunzip -c \
  | PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
      -h "$TARGET_HOST" \
      -p "$TARGET_PORT" \
      -U "$TARGET_USER" \
      -d "$TARGET_DB" \
      --set ON_ERROR_STOP=1

echo "[$(date)] Restauro concluído com sucesso para '$TARGET_DB'."
