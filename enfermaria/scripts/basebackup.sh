#!/bin/sh
# OPS-02 — base backup físico (ponto de partida do restauro para um instante, PITR).
# Corre no contentor de backup (cron semanal). Com o WAL arquivado continuamente, permite
# repor a base para QUALQUER instante entre este base backup e o último WAL enviado.
#
#   base_YYYYMMDD_HHMMSS.tar.gz[.age|.enc]  — cifrado em pipe, nunca em claro no disco.
#
# Requer a entrada `host replication` em postgres/pg_hba.conf (montado no contentor da BD).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"
. "$SCRIPT_DIR/metricas-textfile.sh"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
backup_exigir_cifra
EXT=$(backup_extensao_cifra)
FICHEIRO="$BACKUP_DIR/base_$(date +%Y%m%d_%H%M%S).tar.gz$EXT"
PARCIAL="$FICHEIRO.parcial"
RC="$BACKUP_DIR/.basebackup_rc.$$"
umask 077
trap 'rm -f "$PARCIAL" "$RC"' EXIT

echo "[$(date)] Base backup (PITR) a iniciar..."
# -Ft -D - : tar para stdout (um só tablespace). -X fetch: o WAL necessário para o backup ser
# consistente vai dentro do tar, por isso este ficheiro sozinho já é restaurável.
# --checkpoint=fast: não esperar pelo próximo checkpoint agendado.
{
  PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-}}" pg_basebackup \
    -h "${POSTGRES_HOST:-${DB_HOST:-postgres}}" -U "${POSTGRES_USER:-${DB_USER:-postgres}}" \
    -D - -Ft -X fetch --checkpoint=fast --label "curasphere-$(date +%F)"
  echo $? > "$RC"
} | gzip -6 | backup_cifrar > "$PARCIAL"

if [ "$(cat "$RC" 2>/dev/null)" != "0" ]; then
  echo "[$(date)] ERRO: pg_basebackup falhou (código $(cat "$RC" 2>/dev/null || echo '?'))." >&2
  exit 1
fi
mv "$PARCIAL" "$FICHEIRO"
echo "[$(date)] Base backup: $FICHEIRO ($(du -h "$FICHEIRO" | cut -f1))"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copyto --immutable "$FICHEIRO" "${BACKUP_REMOTE%/}/base/$(basename "$FICHEIRO")"
  echo "[$(date)] Base backup enviado para fora do host."
fi

# Guarda os dois mais recentes localmente (o remoto tem a retenção do bucket).
ls -t "$BACKUP_DIR"/base_*.tar.gz* 2>/dev/null | grep -v '\.parcial$' | tail -n +3 | xargs -r rm -f

metrica_escrever curasphere_basebackup curasphere_basebackup_ultimo_sucesso_timestamp_segundos "$(date +%s)" \
  "Momento do último base backup (PITR) bem-sucedido."
