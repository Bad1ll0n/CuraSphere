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

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR"

log "=== Início da rotina de cópia CuraSphere ==="

# ── 1. Base de dados ─────────────────────────────────────────────────────────
log "[1/3] Base de dados..."
"$SCRIPT_DIR/backup-db.sh"

# ── 2. Uploads (registo clínico em ficheiro) ─────────────────────────────────
# Falhar aqui TEM de falhar a rotina inteira: um backup que só tem a BD dá uma
# falsa sensação de segurança, que é precisamente como se chegou ao OPS-01.
log "[2/3] Uploads (anexos, DICOM, PDFs de alta)..."
if [ ! -d "$UPLOADS_SRC" ]; then
  log "ERRO: directório de uploads não encontrado: $UPLOADS_SRC"
  log "      No contentor 'backup' isto vem do volume api_uploads montado em /uploads-src."
  log "      No host, definir UPLOADS_SRC. A rotina NÃO está completa sem isto."
  exit 1
fi

UPLOADS_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
# `-C` para guardar caminhos relativos: o restauro não deve depender de onde o
# volume estava montado na altura da cópia.
tar -czf "$UPLOADS_FILE" -C "$UPLOADS_SRC" .

# Verificar imediatamente após escrita — um tar corrompido tem de ser detectado
# agora, não no dia da recuperação.
if ! tar -tzf "$UPLOADS_FILE" >/dev/null 2>&1; then
  log "ERRO: o arquivo de uploads não passa a verificação de integridade. A remover."
  rm -f "$UPLOADS_FILE"
  exit 1
fi

N_FICHEIROS=$(tar -tzf "$UPLOADS_FILE" | grep -vc '/$' || true)
TAMANHO=$(du -sh "$UPLOADS_FILE" | cut -f1)
log "      OK: $UPLOADS_FILE ($TAMANHO, $N_FICHEIROS ficheiros) — verificado."

# ── 3. Retenção ──────────────────────────────────────────────────────────────
log "[3/3] Retenção (>${RETENCAO_DIAS} dias)..."
find "$BACKUP_DIR" -name 'uploads_*.tar.gz*' -mtime +"$RETENCAO_DIAS" -delete
find "$BACKUP_DIR" -name 'backup_*.sql.gz*'  -mtime +"$RETENCAO_DIAS" -delete

log "=== Rotina concluída ==="
log "Conteúdo actual de $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" 2>/dev/null | tail -n +2 || log "  (vazio)"

# LEMBRETE OPERACIONAL: estes ficheiros estão no MESMO host que a base de dados.
# Não sobrevivem à perda do host nem a ransomware. Ver DR-RUNBOOK.md §3.3.
