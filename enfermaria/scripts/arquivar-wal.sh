#!/bin/sh
# OPS-02 — archive_command do PostgreSQL: guarda cada segmento de WAL em /wal-arquivo.
#   archive_command = '/scripts/arquivar-wal.sh %p %f'
# Corre DENTRO do contentor da base de dados, como utilizador postgres.
#
# Regras do PostgreSQL para um archive_command:
#   - código 0 só quando o segmento está guardado de forma durável (o PostgreSQL apaga-o a seguir);
#   - nunca sobrescrever um segmento já arquivado com conteúdo diferente;
#   - em erro, sair com código ≠ 0: o PostgreSQL volta a tentar e NÃO recicla o WAL.
# A cópia cifrada para fora do host é feita pelo scripts/enviar-wal.sh (contentor de backup),
# que tem as chaves; aqui fica-se pelo volume local, dentro da mesma fronteira que o PGDATA.

set -eu

ORIGEM="$1"     # %p — caminho do segmento, relativo ao PGDATA
NOME="$2"       # %f — nome do segmento
DESTINO_DIR="${WAL_ARQUIVO_DIR:-/wal-arquivo}"
DESTINO="$DESTINO_DIR/$NOME.gz"

if [ -f "$DESTINO" ]; then
  # Repetição depois de um crash entre a cópia e a confirmação: só é aceitável se for igual.
  if gzip -dc "$DESTINO" | cmp -s - "$ORIGEM"; then exit 0; fi
  echo "arquivar-wal: $NOME já existe com conteúdo DIFERENTE — recusado." >&2
  exit 1
fi

TMP="$DESTINO_DIR/.$NOME.$$"
trap 'rm -f "$TMP"' EXIT
gzip -c "$ORIGEM" > "$TMP"
sync "$TMP" 2>/dev/null || sync
mv "$TMP" "$DESTINO"
trap - EXIT

. "$(dirname "$0")/metricas-textfile.sh"
metrica_escrever curasphere_wal curasphere_wal_ultimo_arquivo_timestamp_segundos "$(date +%s)" \
  "Momento do último segmento de WAL arquivado (PITR)."
