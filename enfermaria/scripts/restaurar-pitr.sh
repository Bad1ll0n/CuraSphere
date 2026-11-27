#!/bin/sh
# OPS-02 — restauro para um instante (PITR): base backup + WAL arquivado → base de dados num
# volume NOVO, no estado exacto de <instante>. Não toca na base em serviço.
#
# Uso:
#   ./scripts/restaurar-pitr.sh <base_backup.tar.gz[.age|.enc]> <dir_wal> ["AAAA-MM-DD HH:MM:SS+00"]
#     <dir_wal>   pasta com os segmentos *.gz (o volume de WAL local, ou os do remoto já
#                 descarregados — ficheiros .age/.enc são decifrados aqui).
#     <instante>  opcional; sem ele, repõe até ao último WAL disponível.
#
# Variáveis: BACKUP_AGE_IDENTITY ou BACKUP_ENCRYPTION_KEY (como no restore-db.sh),
#   VOLUME_DESTINO (por omissão curasphere_pgdata_restaurado_<data>),
#   IMAGEM_PG (a mesma imagem do docker-compose.prod.yml).
#
# Depois: verificar os dados (ver DR-RUNBOOK.md §7) e só então trocar o volume do serviço
# `postgres` por este. O restauro é medido e a duração impressa no fim (RTO).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-cifra.sh"

BASE="${1:?Uso: $0 <base_backup> <dir_wal> [instante]}"
WAL_ORIGEM="${2:?Indique a pasta com o WAL arquivado}"
INSTANTE="${3:-}"
IMAGEM_PG="${IMAGEM_PG:-postgres:16-alpine@sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139}"
VOLUME="${VOLUME_DESTINO:-curasphere_pgdata_restaurado_$(date +%Y%m%d_%H%M%S)}"
VOLUME_WAL="$VOLUME-wal"
CONTENTOR="curasphere-pitr-$$"
INICIO=$(date +%s)

[ -f "$BASE" ] || { echo "ERRO: base backup não encontrado: $BASE" >&2; exit 1; }
[ -d "$WAL_ORIGEM" ] || { echo "ERRO: pasta de WAL não encontrada: $WAL_ORIGEM" >&2; exit 1; }
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "ERRO: o volume $VOLUME já existe — este script nunca escreve por cima de nada." >&2; exit 1
fi

# Os ficheiros passam para volumes Docker por stdin (nada de bind mounts de pastas temporárias:
# funciona igual num host Linux, num runner de CI ou no Docker Desktop).
TRABALHO=$(mktemp -d)
chmod 700 "$TRABALHO"
trap 'docker rm -f "$CONTENTOR" >/dev/null 2>&1 || true; docker volume rm "$VOLUME_WAL" >/dev/null 2>&1 || true; rm -rf "$TRABALHO"' EXIT

echo "[1/5] A preparar o WAL (decifrar o que vier cifrado)..."
mkdir -p "$TRABALHO/wal"
n=0
for f in "$WAL_ORIGEM"/*; do
  [ -f "$f" ] || continue
  case "$f" in
    *.gz.age|*.gz.enc) backup_decifrar "$f" > "$TRABALHO/wal/$(basename "${f%.*}")" ;;
    *.gz)              cp "$f" "$TRABALHO/wal/" ;;
    *) continue ;;
  esac
  n=$((n + 1))
done
echo "      $n segmento(s) disponíveis."
docker volume create "$VOLUME_WAL" >/dev/null
tar -C "$TRABALHO/wal" -cf - . | docker run -i --rm -v "$VOLUME_WAL":/w --entrypoint sh "$IMAGEM_PG" \
  -c 'tar -xf - -C /w && chown -R postgres:postgres /w && chmod -R u+rX,go-rwx /w'
rm -rf "$TRABALHO/wal"

echo "[2/5] A extrair o base backup para o volume novo $VOLUME..."
# Decifrar ANTES de criar o volume: com a chave errada, falha aqui e não a meio.
if ! backup_decifrar "$BASE" | gzip -t 2>/dev/null; then
  echo "ERRO: não foi possível decifrar/descomprimir $BASE (chave em falta ou errada?)." >&2; exit 1
fi
docker volume create "$VOLUME" >/dev/null
# Decifrado em pipe: o base backup em claro nunca toca no disco do host.
backup_decifrar "$BASE" | gunzip -c | docker run -i --rm -v "$VOLUME":/pgdata --entrypoint sh "$IMAGEM_PG" -c '
  set -e
  tar -xf - -C /pgdata
  if [ -f /pgdata/pg_wal.tar ]; then tar -xf /pgdata/pg_wal.tar -C /pgdata/pg_wal; rm /pgdata/pg_wal.tar; fi
  touch /pgdata/recovery.signal
  chown -R postgres:postgres /pgdata && chmod 700 /pgdata'

echo "[3/5] A configurar a recuperação${INSTANTE:+ até $INSTANTE}..."
# A instância restaurada nunca arquiva (não pode escrever no arquivo de produção) e promove-se
# sozinha quando chega ao alvo.
# Argumentos posicionais (e não uma string): o instante tem espaços.
if [ -n "$INSTANTE" ]; then
  set -- -c "recovery_target_time=$INSTANTE" -c recovery_target_inclusive=true
else
  set --
fi

echo "[4/5] A repor o WAL..."
docker run -d --name "$CONTENTOR" --network none \
  -v "$VOLUME":/var/lib/postgresql/data -v "$VOLUME_WAL":/wal-restauro:ro \
  "$IMAGEM_PG" postgres \
    -c archive_mode=off \
    -c "restore_command=gzip -dc /wal-restauro/%f.gz > %p" \
    -c recovery_target_action=promote \
    "$@" >/dev/null

# Pronto quando aceita ligações e já saiu de recuperação.
for _ in $(seq 1 600); do
  if docker exec "$CONTENTOR" psql -U "${DB_USER:-postgres}" -d postgres -tAc 'SELECT pg_is_in_recovery()' 2>/dev/null | grep -q '^f$'; then
    break
  fi
  if ! docker ps -q -f name="^$CONTENTOR$" | grep -q .; then
    echo "ERRO: o PostgreSQL de restauro parou. Logs:" >&2
    docker logs "$CONTENTOR" 2>&1 | tail -30 >&2
    exit 1
  fi
  sleep 1
done
if ! docker exec "$CONTENTOR" psql -U "${DB_USER:-postgres}" -d postgres -tAc 'SELECT pg_is_in_recovery()' 2>/dev/null | grep -q '^f$'; then
  echo "ERRO: a recuperação não terminou em 10 min. Logs:" >&2
  docker logs "$CONTENTOR" 2>&1 | tail -30 >&2
  exit 1
fi
docker logs "$CONTENTOR" 2>&1 | grep -E "recovery stopping|redo done|consistent recovery state|archive recovery complete" | sed 's/^/      /' || true
docker stop "$CONTENTOR" >/dev/null

FIM=$(date +%s)
echo "[5/5] Restauro concluído no volume $VOLUME em $((FIM - INICIO)) s (RTO deste restauro)."
echo "      Próximo passo: verificar os dados (DR-RUNBOOK.md §7) antes de pôr este volume em serviço."
