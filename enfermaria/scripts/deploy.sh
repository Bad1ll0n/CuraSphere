#!/bin/sh
# Deploy CuraSphere para produção
# Uso: ./scripts/deploy.sh
# Requer: .env.prod na raiz do projecto
#
# Ordem, e porquê (OPS-03 / OPS-07). A versão anterior fazia `down` antes de saber se a nova
# arrancava, não tinha rollback, e nunca aplicava o schema nem os triggers de auditoria — uma
# base nova nascia sem o trilho append-only que dá valor probatório ao registo.
#
#   1. guardar as imagens em serviço, para haver para onde voltar;
#   2. construir as imagens novas sem tocar no que está a correr;
#   3. cópia de segurança antes de mexer no schema;
#   4. schema e triggers (serviço `migrate`). O `prisma db push` recusa alterações
#      destrutivas: se a versão nova precisar de uma, o deploy pára aqui com a versão antiga
#      a servir;
#   5. só então substituir api e web — sem `down`: base de dados, cache, nginx e backup
#      nunca param;
#   6. se a API nova não ficar saudável, voltar às imagens anteriores.
#
# Limite conhecido: o rollback troca as imagens, não desfaz o schema do passo 4. É por isso
# que só passam alterações aditivas — as que a versão anterior do código tolera.

set -eu

ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: Ficheiro $ENV_FILE não encontrado."
  echo "Copia .env.example para .env.prod e preenche os valores reais."
  exit 1
fi

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# Ler variáveis necessárias do env file
DB_USER=$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
DB_NAME=${DB_NAME:-enfermaria}

esperar_bd() {
  tentativas=0
  until docker exec curasphere-db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -ge 20 ]; then
      echo "ERRO: a base de dados não ficou pronta ao fim de $((tentativas * 2))s."
      dc logs --tail 30 postgres
      return 1
    fi
    sleep 2
  done
}

esperar_api() {
  tentativas=0
  until docker inspect --format='{{.State.Health.Status}}' curasphere-api 2>/dev/null | grep -q '^healthy$'; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -ge 30 ]; then
      echo ""
      echo "ERRO: a API não ficou healthy em $((tentativas * 3))s. Logs:"
      docker logs curasphere-api --tail 30
      return 1
    fi
    printf "."
    sleep 3
  done
  echo ""
}

TEM_ANTERIOR=0

reverter() {
  if [ "$TEM_ANTERIOR" -ne 1 ]; then
    echo "      Não há imagens anteriores (primeiro deploy com este script): não há para onde voltar."
    return 1
  fi
  echo "[rollback] A repor as imagens anteriores..."
  docker tag curasphere-api:anterior curasphere-api:latest
  docker tag curasphere-web:anterior curasphere-web:latest
  dc up -d --no-deps --force-recreate api web
  if esperar_api; then
    echo "[rollback] A versão anterior voltou ao serviço."
    return 0
  fi
  echo "[rollback] FALHOU: a versão anterior também não ficou saudável. Intervenção manual."
  return 1
}

echo "=== CuraSphere Deploy $(date) ==="

# 1. Código
if [ -d ".git" ]; then
  echo "[1/8] A actualizar código..."
  git pull --ff-only
fi

# 2. Guardar as imagens em serviço — antes do build, que reescreve a etiqueta :latest
echo "[2/8] A guardar as imagens em serviço para rollback..."
if docker image inspect curasphere-api:latest >/dev/null 2>&1 \
  && docker image inspect curasphere-web:latest >/dev/null 2>&1; then
  docker tag curasphere-api:latest curasphere-api:anterior
  docker tag curasphere-web:latest curasphere-web:anterior
  TEM_ANTERIOR=1
  echo "  → curasphere-api:anterior e curasphere-web:anterior guardadas."
else
  echo "  → Sem imagens anteriores: este deploy não terá rollback automático."
fi

# 3. Build — a versão em serviço continua a correr
echo "[3/8] A construir imagens Docker..."
dc build --no-cache api web
dc --profile deploy build migrate

# 4. Base de dados e cache (não fazem nada se já estiverem a correr)
echo "[4/8] A garantir base de dados e cache..."
dc up -d postgres redis
esperar_bd

# 5. Cópia de segurança antes de tocar no schema
echo "[5/8] Cópia de segurança antes do schema..."
if ! dc run --rm --no-deps --entrypoint /scripts/backup-all.sh backup; then
  echo "ERRO: a cópia de segurança falhou. O deploy pára antes de tocar no schema;"
  echo "      a versão em serviço continua a correr."
  exit 1
fi

# 6. Schema, triggers de auditoria e índices de pesquisa
echo "[6/8] A aplicar schema e triggers de auditoria..."
if ! dc --profile deploy run --rm migrate; then
  echo "ERRO: o schema não foi aplicado. A versão em serviço continua a correr, sem alterações."
  echo "      Se o Prisma recusou por perda de dados, a alteração precisa de uma migração prévia"
  echo "      (exemplo: apps/api/scripts/migrar-tokens-familia.mjs). Nunca --accept-data-loss aqui."
  exit 1
fi
docker exec -i curasphere-db psql -U "$DB_USER" -d "$DB_NAME" < scripts/pg-trgm.sql >/dev/null 2>&1 \
  && echo "  → Índices pg_trgm aplicados." \
  || echo "  → AVISO: não foi possível aplicar índices pg_trgm."

# 7. Substituir api e web
echo "[7/8] A substituir api e web..."
dc up -d --no-deps api web
if ! esperar_api; then
  echo "      Um deploy que termina com código 0 sem a API viva faz com que a avaria só seja"
  echo "      descoberta pelos enfermeiros, e não por quem fez o deploy."
  reverter || true
  exit 1
fi

# 8. Restantes serviços e estado final
echo "[8/8] Estado dos serviços:"
dc up -d --no-deps nginx backup
dc ps

echo ""
echo "=== Deploy concluído ==="
echo "Web: https://$(grep ALLOWED_ORIGINS "$ENV_FILE" | cut -d= -f2 | tr -d ' ' | sed 's|https://||' | cut -d, -f1)"
