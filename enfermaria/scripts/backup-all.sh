#!/bin/sh
# Rotina de cópia completa do CuraSphere — base de dados + REGISTO CLÍNICO EM FICHEIRO.
#
# Uso:
#   ./scripts/backup-all.sh                    (host, com DB_* no ambiente ou .env.prod)
#   /scripts/backup-all.sh                     (dentro do contentor `backup`, via cron)
#
# Porque existe (OPS-01): até aqui a "rotina de cópia" era uma linha de crontab
# embutida no docker-compose.prod.yml que só fazia `pg_dump`. Os anexos de
# mensagens, imagens DICOM, fotografias de doentes e PDFs de carta de alta viviam
# dentro do contentor da API, sem volume, e eram destruídos a cada deploy — nunca
# entraram em backup nenhum. Uma recuperação a partir do dump da BD devolvia
# registos clínicos com referências a ficheiros que já não existiam.
#
# Idempotente e seguro de re-executar: cada execução escreve ficheiros novos com
# timestamp próprio e nunca altera os anteriores.

set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
UPLOADS_SRC="${UPLOADS_SRC:-/uploads-src}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# O contentor `backup` recebe POSTGRES_* (convenção da imagem postgres); os
# scripts do repositório falam DB_*. Reconciliar aqui evita que a rotina
# silenciosamente autentique com os valores por omissão errados.
export DB_HOST="${DB_HOST:-${POSTGRES_HOST:-localhost}}"
export DB_PORT="${DB_PORT:-5432}"
export DB_USER="${DB_USER:-${POSTGRES_USER:-postgres}}"
export DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
export DB_NAME="${DB_NAME:-${POSTGRES_DB:-enfermaria}}"
export BACKUP_DIR

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR"
umask 077

# OPS-01: sem cifra configurada, a rotina não escreve nada (ver backup-cifra.sh).
backup_exigir_cifra
EXT=$(backup_extensao_cifra)

log "=== Início da rotina de cópia CuraSphere ==="

# ── 1. Base de dados ─────────────────────────────────────────────────────────
log "[1/4] Base de dados..."
"$SCRIPT_DIR/backup-db.sh"

# ── 2. Uploads (registo clínico em ficheiro) ─────────────────────────────────
# Falhar aqui TEM de falhar a rotina inteira: um backup que só tem a BD dá uma
# falsa sensação de segurança, que é precisamente como se chegou ao OPS-01.
log "[2/4] Uploads (anexos, DICOM, PDFs de alta)..."
if [ ! -d "$UPLOADS_SRC" ]; then
  log "ERRO: directório de uploads não encontrado: $UPLOADS_SRC"
  log "      No contentor 'backup' isto vem do volume api_uploads montado em /uploads-src."
  log "      No host, definir UPLOADS_SRC. A rotina NÃO está completa sem isto."
  exit 1
fi

UPLOADS_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz${EXT}"
UPLOADS_PARCIAL="${UPLOADS_FILE}.parcial"
RC_TAR="${BACKUP_DIR}/.tar_rc.$$"
trap 'rm -f "$UPLOADS_PARCIAL" "$RC_TAR"' EXIT

# `-C` para guardar caminhos relativos: o restauro não deve depender de onde o volume
# estava montado na altura da cópia. OPS-01: o tar vai por pipe para a cifra — o arquivo
# nunca existe em claro no disco. O código do tar guarda-se à parte (sem `pipefail`).
{ tar -czf - -C "$UPLOADS_SRC" .; echo $? > "$RC_TAR"; } | backup_cifrar > "$UPLOADS_PARCIAL"
if [ "$(cat "$RC_TAR" 2>/dev/null)" != "0" ]; then
  log "ERRO: o tar dos uploads falhou (código $(cat "$RC_TAR" 2>/dev/null || echo '?'))."
  exit 1
fi

# Verificar imediatamente após escrita — um arquivo corrompido tem de ser detectado
# agora, não no dia da recuperação.
if backup_pode_verificar_conteudo "$UPLOADS_FILE"; then
  if ! backup_decifrar "$UPLOADS_PARCIAL" | tar -tzf - >/dev/null 2>&1; then
    log "ERRO: o arquivo de uploads não passa a verificação de integridade. A remover."
    exit 1
  fi
  N_FICHEIROS=$(backup_decifrar "$UPLOADS_PARCIAL" | tar -tzf - | grep -vc '/$' || true)
elif ! backup_cabecalho_age_valido "$UPLOADS_PARCIAL"; then
  log "ERRO: o arquivo de uploads cifrado com age não tem um cabeçalho válido. A remover."
  exit 1
else
  N_FICHEIROS="?"
fi
mv "$UPLOADS_PARCIAL" "$UPLOADS_FILE"

TAMANHO=$(du -sh "$UPLOADS_FILE" | cut -f1)
log "      OK: $UPLOADS_FILE ($TAMANHO, $N_FICHEIROS ficheiros) — verificado."

# ── 3. Cópia fora do host ────────────────────────────────────────────────────
# OPS-01: as cópias locais não sobrevivem à perda do host nem a ransomware. Com
# BACKUP_REMOTE (um destino do rclone, ex.: `b2:curasphere-backups`) os ficheiros desta
# execução seguem para object storage noutro sítio. O bucket deve ter Object Lock
# (imutabilidade) e as credenciais devem só poder escrever — ver DR-RUNBOOK.md §3.3.
log "[3/4] Cópia fora do host..."
if [ -n "${BACKUP_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    log "ERRO: BACKUP_REMOTE definido mas o 'rclone' não está instalado."
    exit 1
  fi
  BD_FILE=$(ls -t "$BACKUP_DIR"/backup_*.sql.gz* 2>/dev/null | grep -v '\.parcial$' | head -n 1)
  for f in "$BD_FILE" "$UPLOADS_FILE"; do
    # --immutable: nunca reescreve um objecto que já exista no destino.
    if ! rclone copyto --immutable "$f" "${BACKUP_REMOTE%/}/$(basename "$f")"; then
      log "ERRO: falhou a cópia de $(basename "$f") para $BACKUP_REMOTE."
      exit 1
    fi
  done
  log "      OK: cópia enviada para $BACKUP_REMOTE."
else
  log "      AVISO: BACKUP_REMOTE não definido — as cópias ficam SÓ neste host."
fi

# ── 3. Retenção ──────────────────────────────────────────────────────────────
log "[4/4] Retenção local (>${RETENCAO_DIAS} dias)..."
find "$BACKUP_DIR" -name 'uploads_*.tar.gz*' ! -name '*.parcial' -mtime +"$RETENCAO_DIAS" -delete
find "$BACKUP_DIR" -name 'backup_*.sql.gz*'  ! -name '*.parcial' -mtime +"$RETENCAO_DIAS" -delete

log "=== Rotina concluída ==="
log "Conteúdo actual de $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" 2>/dev/null | tail -n +2 || log "  (vazio)"

# A retenção do destino remoto é a do bucket (Object Lock / lifecycle), não esta.
