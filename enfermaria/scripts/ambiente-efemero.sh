#!/bin/sh
# OPS-21 — ambiente efémero: arranca o stack de PRODUÇÃO completo (docker-compose.prod.yml:
# imagens construídas pelos Dockerfiles, migrações + triggers de auditoria, 2 réplicas da API,
# web, nginx com TLS e allowlist) e prova que serve, como o veria um posto do hospital.
#
# Até aqui nada provava que o compose de produção arrancava: o CI testava a api e a web soltas.
# Corre no CI (workflow "Ambiente efémero") em cada PR que mexa em Dockerfiles, compose, nginx
# ou scripts de deploy, e todas as noites; localmente: sh scripts/ambiente-efemero.sh
#
#   sh scripts/ambiente-efemero.sh            → subir + verificar + descer
#   MANTER=1 sh scripts/ambiente-efemero.sh   → não descer no fim (inspecção à mão)
#
# Dados: só os utilizadores de teste sintéticos (seed-test-users). NUNCA dados reais.
set -eu

cd "$(dirname "$0")/.."
ENV_FILE=".env.efemero"
dc() { docker compose -p curasphere-efemero -f docker-compose.prod.yml -f docker-compose.efemero.yml --env-file "$ENV_FILE" "$@"; }
DOMINIO="curasphere.hospital.pt"   # o server_name do nginx.conf
CURL_IMG="curlimages/curl:8.17.0"

falhar() { echo "FALHOU: $*"; dc ps || true; dc logs --tail 60 api nginx web 2>/dev/null || true; exit 1; }

descer() {
  [ "${CERT_TEMPORARIO:-0}" = "1" ] && rm -f nginx/ssl/fullchain.pem nginx/ssl/privkey.pem
  [ "${MANTER:-0}" = "1" ] && { echo "(MANTER=1: o ambiente fica a correr; descer com: docker compose -p curasphere-efemero down -v)"; return; }
  dc down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_FILE"
}
trap descer EXIT

# ── 1. Segredos aleatórios (descartáveis) e certificado autoassinado ─────────
if [ ! -f "$ENV_FILE" ]; then
  aleat() { openssl rand -hex "$1"; }
  cat > "$ENV_FILE" <<EOF
# Gerado por scripts/ambiente-efemero.sh — descartável, apagado no fim.
CURASPHERE_VERSION=efemero
DB_USER=curasphere
DB_PASSWORD=$(aleat 16)
DB_NAME=enfermaria
JWT_SECRET=$(aleat 32)
ENCRYPTION_KEY=$(aleat 32)
AUDIT_SIGNING_KEY=$(aleat 32)
METRICS_TOKEN=$(aleat 16)
ALLOWED_ORIGINS=https://$DOMINIO
NEXT_PUBLIC_API_URL=https://$DOMINIO/api
NEXT_PUBLIC_WEB_URL=https://$DOMINIO
NEXT_PUBLIC_JITSI_SERVER=https://jitsi.exemplo.invalid
JITSI_SERVER=https://jitsi.exemplo.invalid
JITSI_APP_ID=curasphere
JITSI_APP_SECRET=$(aleat 16)
SPMS_API_URL=https://spms.exemplo.invalid
SNS_PEM_MODE=sandbox
API_REPLICAS=2
WEB_REPLICAS=1
EOF
fi
if [ ! -f nginx/ssl/fullchain.pem ]; then
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$DOMINIO" \
    -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem >/dev/null 2>&1
  CERT_TEMPORARIO=1
fi

# ── 2. Imagens (as mesmas que a release constrói) ────────────────────────────
echo "[1/5] A construir as imagens (api, web, migrate)..."
dc build api web >/dev/null
dc --profile deploy build migrate >/dev/null

# ── 3. BD, cache, schema, triggers e utilizadores de teste ───────────────────
echo "[2/5] PostgreSQL, Redis, migrações e triggers de auditoria..."
dc up -d postgres redis
i=0; until dc exec -T postgres pg_isready -U curasphere -d enfermaria >/dev/null 2>&1; do
  i=$((i + 1)); [ $i -lt 60 ] || falhar "a BD não ficou pronta"; sleep 2; done
dc --profile deploy run --rm migrate || falhar "migrações / triggers de auditoria"
dc --profile deploy run --rm migrate sh -c "npx ts-node --transpile-only src/prisma/seed-test-users.ts" >/dev/null \
  || falhar "seed dos utilizadores de teste"

# ── 4. Aplicação e nginx ──────────────────────────────────────────────────────
echo "[3/5] API (2 réplicas), web e nginx..."
dc up -d api web nginx
for servico in api web; do
  for c in $(dc ps -q "$servico"); do
    i=0; until docker inspect -f '{{.State.Health.Status}}' "$c" | grep -q '^healthy$'; do
      i=$((i + 1)); [ $i -lt 80 ] || falhar "$servico ($c) não ficou healthy"; sleep 3; done
  done
done
[ "$(dc ps -q api | wc -l | tr -d ' ')" -eq 2 ] || falhar "deviam estar 2 réplicas da API"

# ── 5. Verificação, de fora, como um posto de trabalho ───────────────────────
echo "[4/5] Smoke test pela rede cliente (TLS, allowlist, cabeçalhos, API, web, isolamento)..."
pedir() { docker run --rm --network curasphere-efemero-cliente "$CURL_IMG" -sk -o /dev/null -w '%{http_code}' \
  --resolve "$DOMINIO:443:$(docker inspect -f '{{(index .NetworkSettings.Networks "curasphere-efemero-cliente").IPAddress}}' "$(dc ps -q nginx)")" "$@"; }
NGINX_IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "curasphere-efemero-cliente").IPAddress}}' "$(dc ps -q nginx)")
cabecalhos=$(docker run --rm --network curasphere-efemero-cliente "$CURL_IMG" -skI --resolve "$DOMINIO:443:$NGINX_IP" "https://$DOMINIO/login")

e=$(pedir "https://$DOMINIO/api/v1/health/ready"); [ "$e" = "200" ] || falhar "API não pronta pelo nginx (HTTP $e)"
e=$(pedir "https://$DOMINIO/login"); [ "$e" = "200" ] || falhar "página de login (HTTP $e)"
e=$(pedir "https://$DOMINIO/quiosque"); [ "$e" = "200" ] || falhar "quiosque (HTTP $e)"
e=$(pedir "https://$DOMINIO/api/v1/doentes"); [ "$e" = "401" ] || falhar "rota clínica sem sessão devia dar 401 (HTTP $e)"
echo "$cabecalhos" | grep -qi '^strict-transport-security:' || falhar "falta HSTS"
echo "$cabecalhos" | grep -qi '^content-security-policy:' || falhar "falta CSP"
# A API responde pelas duas réplicas (least_conn): 20 pedidos, nenhum falhado.
for _ in $(seq 1 20); do e=$(pedir "https://$DOMINIO/api/v1/health/live"); [ "$e" = "200" ] || falhar "health/live (HTTP $e)"; done
# Isolamento: a rede cliente não chega à BD nem ao Redis.
if docker run --rm --network curasphere-efemero-cliente "$CURL_IMG" -s -m 3 telnet://postgres:5432 >/dev/null 2>&1; then
  falhar "a BD é alcançável a partir da rede cliente"
fi
# Allowlist: um IP fora da LAN/VPN (rede Docker 172.x) é recusado pelo nginx.
e=$(docker run --rm --network curasphere-lb "$CURL_IMG" -sk -o /dev/null -w '%{http_code}' --resolve "$DOMINIO:443:$(docker inspect -f '{{(index .NetworkSettings.Networks "curasphere-lb").IPAddress}}' "$(dc ps -q nginx)")" "https://$DOMINIO/login")
[ "$e" = "403" ] || falhar "a allowlist devia recusar um IP fora da rede do hospital (HTTP $e)"

# ── 6. Trilho de auditoria imutável na BD que acabou de nascer ───────────────
echo "[5/5] Trilho de auditoria append-only..."
if dc exec -T postgres psql -U curasphere -d enfermaria -c "DELETE FROM audit_logs" >/dev/null 2>&1; then
  falhar "o DELETE em audit_logs devia ser recusado pelos triggers"
fi

echo "OK — o stack de produção arranca de ponta a ponta e serve como esperado."
