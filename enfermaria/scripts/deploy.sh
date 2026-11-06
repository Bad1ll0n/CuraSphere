#!/bin/sh
# Deploy CuraSphere para produção
# Uso: ./scripts/deploy.sh <versão>     ex.: ./scripts/deploy.sh v1.4.0
#      ./scripts/deploy.sh local        constrói as imagens no próprio servidor (sem registry)
# Requer: .env.prod na raiz do projecto
#
# OPS-10/OPS-11: o deploy instala uma VERSÃO, não "o que estiver no disco". As imagens são
# construídas, analisadas (Trivy), assinadas (cosign) e publicadas pelo workflow de release
# (.github/workflows/release.yml) a partir de uma tag vX.Y.Z; aqui só se descarregam. O
# `git pull` que existia era código morto (o .git está na raiz do repositório, não aqui) e
# o build no servidor de produção produzia sempre `:latest`, sem rasto do que estava a correr.
# A versão em serviço fica em .versao-em-servico e o histórico em deploys.log.
#
# Ordem, e porquê (OPS-03 / OPS-07). A versão anterior fazia `down` antes de saber se a nova
# arrancava, não tinha rollback, e nunca aplicava o schema nem os triggers de auditoria — uma
# base nova nascia sem o trilho append-only que dá valor probatório ao registo.
#
#   1. guardar as imagens em serviço, para haver para onde voltar;
#   2. construir as imagens novas sem tocar no que está a correr;
#   3. cópia de segurança antes de mexer no schema;
#   4. schema e triggers (serviço `migrate`: `prisma migrate deploy` — ARQ-11). Se uma
#      migração falhar, o deploy pára aqui com a versão antiga a servir;
#   5. só então substituir api e web — sem `down`: base de dados, cache, nginx e backup
#      nunca param;
#   6. se a API nova não ficar saudável, voltar às imagens anteriores.
#
# Limite conhecido: o rollback troca as imagens, não desfaz o schema do passo 4. É por isso
# que só passam alterações aditivas — as que a versão anterior do código tolera.

set -eu

ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"
FICHEIRO_VERSAO=".versao-em-servico"

VERSAO="${1:-}"
case "$VERSAO" in
  v[0-9]*.[0-9]*.[0-9]*|local) ;;
  *)
    echo "Uso: $0 <vX.Y.Z | local>"
    echo "  A versão é a tag publicada pelo workflow de release (ver docs/RELEASE.md)."
    exit 1 ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: Ficheiro $ENV_FILE não encontrado."
  echo "Copia .env.example para .env.prod e preenche os valores reais."
  exit 1
fi

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

PREFIXO=$(grep '^CURASPHERE_IMAGE_PREFIX=' "$ENV_FILE" | cut -d= -f2 | tr -d ' "')
PREFIXO=${PREFIXO:-curasphere}
if [ "$VERSAO" != "local" ] && [ "$PREFIXO" = "curasphere" ]; then
  echo "ERRO: CURASPHERE_IMAGE_PREFIX em falta no $ENV_FILE (ex.: ghcr.io/<dono>/curasphere)."
  exit 1
fi
ANTERIOR=$(cat "$FICHEIRO_VERSAO" 2>/dev/null || true)

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

reverter() {
  if [ -z "$ANTERIOR" ]; then
    echo "      Não há versão anterior registada ($FICHEIRO_VERSAO): não há para onde voltar."
    return 1
  fi
  echo "[rollback] A repor a versão $ANTERIOR..."
  CURASPHERE_VERSION="$ANTERIOR" dc up -d --no-deps --force-recreate api web
  if esperar_api; then
    echo "[rollback] A versão $ANTERIOR voltou ao serviço."
    echo "$(date -u +%FT%TZ) rollback $VERSAO -> $ANTERIOR" >> deploys.log
    return 0
  fi
  echo "[rollback] FALHOU: a versão anterior também não ficou saudável. Intervenção manual."
  return 1
}

echo "=== CuraSphere Deploy $VERSAO $(date) (em serviço: ${ANTERIOR:-nenhuma}) ==="
export CURASPHERE_VERSION="$VERSAO"

# 1-3. Obter as imagens da versão — a versão em serviço continua a correr
if [ "$VERSAO" = "local" ]; then
  # Sem registry: constrói-se aqui. A etiqueta `local` é reescrita, por isso guarda-se a
  # imagem em serviço como `local-anterior` para haver rollback.
  echo "[1/8] Modo local: a guardar as imagens em serviço..."
  if docker image inspect "$PREFIXO-api:local" >/dev/null 2>&1 && docker image inspect "$PREFIXO-web:local" >/dev/null 2>&1; then
    docker tag "$PREFIXO-api:local" "$PREFIXO-api:local-anterior"
    docker tag "$PREFIXO-web:local" "$PREFIXO-web:local-anterior"
    ANTERIOR="local-anterior"
  fi
  echo "[2/8] (sem verificação de assinatura: imagens construídas localmente)"
  echo "[3/8] A construir imagens Docker..."
  dc build --no-cache api web
  dc --profile deploy build migrate
else
  echo "[1/8] A descarregar as imagens $VERSAO de $PREFIXO..."
  dc pull api web
  dc --profile deploy pull migrate
  # 2. Assinatura (OPS-15): só corre o que o workflow de release deste repositório assinou.
  if command -v cosign >/dev/null 2>&1; then
    echo "[2/8] A verificar assinaturas (cosign)..."
    REPO_GH=$(grep '^CURASPHERE_GITHUB_REPO=' "$ENV_FILE" | cut -d= -f2 | tr -d ' "')
    if [ -z "$REPO_GH" ]; then
      echo "ERRO: CURASPHERE_GITHUB_REPO em falta no $ENV_FILE (ex.: dono/CuraSphere)."; exit 1
    fi
    for app in api web migrate; do
      if ! cosign verify "$PREFIXO-$app:$VERSAO" \
          --certificate-identity-regexp "^https://github.com/$REPO_GH/.github/workflows/release.yml@refs/tags/" \
          --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null; then
        echo "ERRO: a imagem $PREFIXO-$app:$VERSAO não tem assinatura válida do workflow de release."
        exit 1
      fi
    done
    echo "  → Assinaturas válidas."
  else
    echo "[2/8] AVISO: cosign não instalado — assinaturas NÃO verificadas (instalar: docs/RELEASE.md)."
  fi
  echo "[3/8] (imagens do registry: sem build no servidor)"
fi

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
echo "$VERSAO" > "$FICHEIRO_VERSAO"
echo "$(date -u +%FT%TZ) deploy ${ANTERIOR:-nenhuma} -> $VERSAO" >> deploys.log

echo ""
echo "=== Deploy de $VERSAO concluído ==="
echo "Web: https://$(grep ALLOWED_ORIGINS "$ENV_FILE" | cut -d= -f2 | tr -d ' ' | sed 's|https://||' | cut -d, -f1)"
