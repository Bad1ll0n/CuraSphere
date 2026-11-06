#!/bin/sh
# Backup da base de dados CuraSphere
# Uso: ./scripts/backup-db.sh
# Requer: DB_USER, DB_PASSWORD, DB_HOST, DB_NAME (ou .env.prod). BACKUP_DIR opcional.
# Cifra: BACKUP_AGE_RECIPIENT (recomendado) ou BACKUP_ENCRYPTION_KEY — ver backup-cifra.sh.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"

# BACKUP_DIR vem do ambiente: `backup-all.sh` exporta-o, e no contentor `backup` o compose
# define-o como o volume montado. Um caminho relativo fixo dependia do directório de
# trabalho de quem chamava — e o do cron não é o volume.
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"

backup_exigir_cifra
EXT=$(backup_extensao_cifra)
FILENAME="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz${EXT}"
PARCIAL="${FILENAME}.parcial"
RC_FILE="${BACKUP_DIR}/.pg_dump_rc.$$"

mkdir -p "$BACKUP_DIR"
umask 077

# Um backup interrompido nunca pode ficar com o nome de um backup bom.
trap 'rm -f "$PARCIAL" "$RC_FILE"' EXIT

# OPS-04: sem `--clean --if-exists` o dump so se consegue repor numa base VAZIA — e a
# base a repor num desastre real nunca esta vazia (o Postgres cria-a ja com o schema
# `public`, ou tem restos de uma tentativa anterior). Sem `--no-owner --no-acl`, o
# restauro falha se o utilizador de recuperacao nao for o dono original dos objectos.
#
# OPS-01: o dump vai directamente do pg_dump para a cifra, por pipe — nunca existe em
# claro no disco, nem como ficheiro temporário.
#
# OPS-08: num pipe, o `sh` só vê o código de saída do ÚLTIMO comando (e `pipefail` não é
# POSIX). Com o pg_dump a falhar a meio, a cifra terminava bem e ficava um backup
# "válido" e incompleto. O código do pg_dump é guardado à parte e verificado.
echo "[$(date)] A iniciar backup da base de dados (cifra: ${EXT:-NENHUMA})..."

{
  PGPASSWORD="${DB_PASSWORD:-postgres}" \
    pg_dump \
      -h "${DB_HOST:-localhost}" \
      -p "${DB_PORT:-5432}" \
      -U "${DB_USER:-postgres}" \
      --clean --if-exists \
      --no-owner --no-acl \
      -Z 6 \
      "${DB_NAME:-enfermaria}"
  echo $? > "$RC_FILE"
} | backup_cifrar > "$PARCIAL"

if [ "$(cat "$RC_FILE" 2>/dev/null)" != "0" ]; then
  echo "[$(date)] ERRO: o pg_dump falhou (código $(cat "$RC_FILE" 2>/dev/null || echo '?')). Backup NÃO concluído." >&2
  exit 1
fi

# Verificado antes de o ficheiro ganhar o nome definitivo, e não no dia em que for preciso
# repô-lo: decifra-se, o arquivo tem de descomprimir, e o dump tem de terminar na marca
# que o próprio pg_dump escreve quando chega ao fim.
if backup_pode_verificar_conteudo "$FILENAME"; then
  if ! backup_decifrar "$PARCIAL" | gzip -t 2>/dev/null; then
    echo "[$(date)] ERRO: o arquivo não decifra/descomprime. Backup NÃO concluído." >&2
    exit 1
  fi
  if ! backup_decifrar "$PARCIAL" | gzip -dc | tail -n 20 | grep -q 'PostgreSQL database dump complete'; then
    echo "[$(date)] ERRO: o dump termina a meio (falta a marca final do pg_dump). Backup NÃO concluído." >&2
    exit 1
  fi
else
  # age sem chave privada no host (o normal): confirma-se o formato; o conteúdo valida-se
  # no ensaio de restauro (ver DR-RUNBOOK.md).
  if ! backup_cabecalho_age_valido "$PARCIAL"; then
    echo "[$(date)] ERRO: o ficheiro cifrado com age não tem um cabeçalho válido. Backup NÃO concluído." >&2
    exit 1
  fi
fi

mv "$PARCIAL" "$FILENAME"
SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date)] Backup concluído e verificado: $FILENAME ($SIZE)"

# A retenção só corre depois de um backup bom: com o `set -e`, uma falha acima termina o
# script antes de chegar aqui, e os backups antigos ficam onde estão.
find "$BACKUP_DIR" -name "backup_*.sql.gz*" ! -name "*.parcial" -mtime +"$RETENCAO_DIAS" -delete
echo "[$(date)] Backups antigos (>$RETENCAO_DIAS dias) removidos."

echo "[$(date)] Backups disponíveis:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz* 2>/dev/null || echo "  (nenhum)"
