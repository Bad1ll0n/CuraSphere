#!/bin/sh
# OPS-03 — restauro dos uploads (anexos, DICOM, fotografias, PDFs de alta) a partir de um
# `uploads_*.tar.gz[.age|.enc]` gerado por scripts/backup-all.sh.
#
# A rotina guardava os uploads mas não havia como os repor: o runbook mandava "repor o bucket
# S3/MinIO", que não é o que a rotina copia (copia o volume `api_uploads`). Sem isto, uma
# recuperação devolvia a BD com referências a ficheiros que não existiam.
#
# Uso:
#   UPLOADS_DESTINO=/caminho ./scripts/restaurar-uploads.sh [backups/uploads_<data>.tar.gz.age]
#   Sem ficheiro: o mais recente em $BACKUP_DIR. Cifra: BACKUP_AGE_IDENTITY (age) ou
#   BACKUP_ENCRYPTION_KEY (openssl) — ver backup-cifra.sh.
# No servidor, o destino é o volume `api_uploads` (ver DR-RUNBOOK.md §4.3):
#   docker run --rm -v curasphere_api_uploads:/destino -v "$PWD:/w" -w /w -e UPLOADS_DESTINO=/destino \
#     -e BACKUP_AGE_IDENTITY=/w/<chave> curasphere-backup:<versão> ./scripts/restaurar-uploads.sh
#
# Destrutivo se o destino não estiver vazio (os ficheiros com o mesmo nome são substituídos):
# pede confirmação, salvo RESTAURO_NAO_INTERATIVO=sim (ensaios automáticos).
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DESTINO="${UPLOADS_DESTINO:-}"
FICHEIRO="${1:-}"

[ -n "$DESTINO" ] || { echo "ERRO: UPLOADS_DESTINO em falta (o directório/volume dos uploads a repor)." >&2; exit 1; }
if [ -z "$FICHEIRO" ]; then
  FICHEIRO=$(ls -t "$BACKUP_DIR"/uploads_*.tar.gz* 2>/dev/null | grep -v '\.parcial$' | head -n 1 || true)
  [ -n "$FICHEIRO" ] || { echo "ERRO: nenhum uploads_*.tar.gz* em $BACKUP_DIR." >&2; exit 1; }
  echo "[$(date)] A usar o mais recente: $FICHEIRO"
fi
[ -f "$FICHEIRO" ] || { echo "ERRO: ficheiro não encontrado: $FICHEIRO" >&2; exit 1; }

# Decifrar e listar ANTES de tocar no destino: com a chave errada falha aqui, não a meio.
N=$(backup_decifrar "$FICHEIRO" | tar -tzf - 2>/dev/null | grep -vc '/$' || true)
if ! backup_decifrar "$FICHEIRO" | tar -tzf - >/dev/null 2>&1; then
  echo "ERRO: não foi possível decifrar/ler $FICHEIRO (chave em falta ou errada?)." >&2
  exit 1
fi

mkdir -p "$DESTINO"
EXISTENTES=$(find "$DESTINO" -type f | wc -l | tr -d ' ')
echo "=============================================================="
echo "  RESTAURO DOS UPLOADS"
echo "  Arquivo: $FICHEIRO ($N ficheiros)"
echo "  Destino: $DESTINO ($EXISTENTES ficheiros já lá)"
echo "=============================================================="
if [ "$EXISTENTES" -gt 0 ] && [ "${RESTAURO_NAO_INTERATIVO:-}" != "sim" ]; then
  printf "O destino não está vazio — os ficheiros com o mesmo nome são substituídos. Escreve 'sim': "
  read -r OK
  [ "$OK" = "sim" ] || { echo "Cancelado."; exit 1; }
fi

backup_decifrar "$FICHEIRO" | tar -xzf - -C "$DESTINO"
REPOSTOS=$(find "$DESTINO" -type f | wc -l | tr -d ' ')
[ "$REPOSTOS" -ge "$N" ] || { echo "ERRO: só $REPOSTOS ficheiros no destino, esperados pelo menos $N." >&2; exit 1; }
echo "[$(date)] Uploads repostos: $N ficheiros em $DESTINO."
