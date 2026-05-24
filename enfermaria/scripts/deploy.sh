#!/bin/sh
# Deploy CuraSphere para produção
# Uso: ./scripts/deploy.sh
# Requer: .env.prod na raiz do projecto

set -e

ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: Ficheiro $ENV_FILE não encontrado."
  echo "Copia .env.example para .env.prod e preenche os valores reais."
  exit 1
fi

# Ler variáveis necessárias do env file
DB_USER=$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
DB_NAME=${DB_NAME:-enfermaria}

echo "=== CuraSphere Deploy $(date) ==="

# 1. Pull das últimas alterações (se usar git no servidor)
if [ -d ".git" ]; then
  echo "[1/7] A actualizar código..."
  git pull --ff-only
fi

# 2. Build das imagens
echo "[2/7] A construir imagens Docker..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

# 3. Parar serviços actuais (sem apagar volumes)
echo "[3/7] A parar serviços actuais..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans

# 4. Subir novos serviços
echo "[4/7] A iniciar serviços..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# 5. Aguardar DB ficar healthy e aplicar índices pg_trgm
echo "[5/7] A aplicar índices de pesquisa (pg_trgm)..."
DB_RETRIES=0
until docker exec curasphere-db pg_isready -U "$DB_USER" -d "$DB_NAME" 2>/dev/null; do
  DB_RETRIES=$((DB_RETRIES+1))
  if [ "$DB_RETRIES" -ge 20 ]; then
    echo "AVISO: DB não ficou pronta para os índices."
    break
  fi
  sleep 2
done
docker exec -i curasphere-db psql -U "$DB_USER" -d "$DB_NAME" < scripts/pg-trgm.sql 2>/dev/null \
  && echo "  → Índices pg_trgm aplicados." \
  || echo "  → AVISO: não foi possível aplicar índices pg_trgm."

# 6. Aguardar API ficar healthy
echo "[6/7] A aguardar API ficar disponível..."
RETRIES=0
MAX=30
until docker inspect --format='{{.State.Health.Status}}' curasphere-api 2>/dev/null | grep -q "healthy"; do
  RETRIES=$((RETRIES+1))
  if [ "$RETRIES" -ge "$MAX" ]; then
    echo "AVISO: API não ficou healthy em ${MAX}s. Verifica os logs:"
    docker logs curasphere-api --tail 30
    break
  fi
  printf "."
  sleep 3
done
echo ""

# 7. Estado final
echo "[7/7] Estado dos serviços:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo ""
echo "=== Deploy concluído ==="
echo "Web: https://$(grep ALLOWED_ORIGINS $ENV_FILE | cut -d= -f2 | tr -d ' ' | sed 's|https://||' | cut -d, -f1)"
