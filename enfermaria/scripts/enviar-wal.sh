#!/bin/sh
# OPS-02 — envia para fora do host, cifrados, os segmentos de WAL ainda não enviados.
# Corre no contentor de backup (cron a cada 5 min). Sem BACKUP_REMOTE, só gere a retenção local.
#
# Cada segmento é cifrado em pipe (nunca existe em claro fora do volume de WAL) e enviado com
# `--immutable`. Um marcador em .enviados/ evita reenviar. Segmentos locais mais velhos do que
# WAL_RETENCAO_DIAS (por omissão 8: o base backup é semanal) são apagados só depois de enviados.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"
. "$SCRIPT_DIR/metricas-textfile.sh"

WAL_DIR="${WAL_ARQUIVO_DIR:-/wal-arquivo}"
ENVIADOS="$WAL_DIR/.enviados"
RETENCAO="${WAL_RETENCAO_DIAS:-8}"
mkdir -p "$ENVIADOS"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  backup_exigir_cifra
  EXT=$(backup_extensao_cifra)
  n=0
  for f in "$WAL_DIR"/*.gz; do
    [ -e "$f" ] || continue
    nome=$(basename "$f")
    [ -e "$ENVIADOS/$nome" ] && continue
    tmp="$WAL_DIR/.envio.$nome$EXT.$$"
    backup_cifrar < "$f" > "$tmp"
    if rclone copyto --immutable "$tmp" "${BACKUP_REMOTE%/}/wal/$nome$EXT"; then
      : > "$ENVIADOS/$nome"; n=$((n + 1))
    else
      rm -f "$tmp"; echo "[$(date)] ERRO: falhou o envio de $nome." >&2; exit 1
    fi
    rm -f "$tmp"
  done
  metrica_escrever curasphere_wal_envio curasphere_wal_ultimo_envio_externo_timestamp_segundos "$(date +%s)" \
    "Momento da última passagem bem-sucedida de envio de WAL para fora do host."
  [ "$n" -gt 0 ] && echo "[$(date)] WAL: $n segmento(s) enviados para fora do host."
  # Retenção local: só o que já saiu.
  find "$WAL_DIR" -maxdepth 1 -name '*.gz' -mtime +"$RETENCAO" | while read -r f; do
    [ -e "$ENVIADOS/$(basename "$f")" ] && rm -f "$f" "$ENVIADOS/$(basename "$f")"
  done
else
  # Sem destino externo o PITR protege contra corrupção lógica, não contra perder o host.
  find "$WAL_DIR" -maxdepth 1 -name '*.gz' -mtime +"$RETENCAO" -delete
fi
