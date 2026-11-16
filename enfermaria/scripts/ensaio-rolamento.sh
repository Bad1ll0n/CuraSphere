#!/bin/sh
# OPS-09 — ensaio do deploy sem paragem, com o MESMO código do deploy (scripts/lib-rolamento.sh).
#
# Monta um projecto compose mínimo: um serviço `app` com 2 réplicas atrás de um nginx com o
# mesmo tipo de upstream e de rede de balanceamento da produção. Com pedidos
# contínuos ao nginx:
#   1. rola v1 → v2: zero pedidos falhados e, no fim, só responde a v2;
#   2. tenta rolar para uma versão que nunca fica saudável: o rolamento falha, os contentores
#      novos são removidos, a v2 continua a responder — também com zero pedidos falhados.
# Corre no CI (workflow "Ensaio DR") e localmente: sh scripts/ensaio-rolamento.sh
set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
PROJ="ensaio-rolamento-$$"
PORTA="${PORTA_ENSAIO:-18099}"
NGINX_IMG="nginx:1.30-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311"

cat > "$TMP/compose.yml" <<EOF
services:
  app:
    image: $NGINX_IMG
    environment:
      VERSAO: \${VERSAO:-v1}
      FALHAR: \${FALHAR:-0}
    # A "versão" fica no index; FALHAR=1 simula uma versão que nunca fica saudável.
    command: ["sh", "-c", "echo \$\$VERSAO > /usr/share/nginx/html/index.html; if [ \$\$FALHAR = 1 ]; then rm /usr/share/nginx/html/index.html; fi; exec nginx -g 'daemon off;'"]
    stop_grace_period: 5s
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 2s
      timeout: 2s
      retries: 2
      start_period: 2s
    networks: [interna, lb]
  lb:
    image: $NGINX_IMG
    ports: ["$PORTA:80"]
    volumes: ["./lb.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [app]
    networks: [lb]
networks:
  interna: {}
  lb:
    name: $PROJ-lb
EOF

cat > "$TMP/lb.conf" <<'EOF'
events {}
http {
  proxy_connect_timeout 2s;
  upstream app_up {
    server app:80 max_fails=1 fail_timeout=5s;
  }
  server {
    listen 80;
    location / { proxy_pass http://app_up; proxy_next_upstream error timeout http_502; }
  }
}
EOF

dc() { docker compose -p "$PROJ" -f "$TMP/compose.yml" "$@"; }
pronto_url() { echo "http://127.0.0.1/"; }
replicas_de() { echo 2; }
# shellcheck disable=SC2034  # lido pelo lib-rolamento.sh
REDE_LB="$PROJ-lb"
contentor_lb() { dc ps -q lb; }
# shellcheck source=scripts/lib-rolamento.sh
. "$DIR/lib-rolamento.sh"

limpar() { dc down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpar EXIT

# Pedidos contínuos (10/s); cada falha (não-200) fica registada.
carga() {
  : > "$TMP/falhas"; : > "$TMP/respostas"
  while [ ! -f "$TMP/parar" ]; do
    r=$(curl -s -m 8 -w ' %{http_code}' "http://localhost:$PORTA/" 2>/dev/null | tr -d '\n' || echo " 000")
    case "$r" in *" 200") echo "${r% 200}" >> "$TMP/respostas" ;; *) echo "$r" >> "$TMP/falhas" ;; esac
    sleep 0.1
  done
}

echo "[1/4] v1 com 2 réplicas atrás do nginx..."
VERSAO=v1 dc up -d --scale app=2 >/dev/null
for c in $(dc ps -q app); do esperar_contentor "$c" app; done
i=0; until curl -sf "http://localhost:$PORTA/" >/dev/null; do i=$((i+1)); [ $i -lt 30 ] || { echo "nginx não respondeu"; exit 1; }; sleep 1; done

echo "[2/4] A rolar v1 → v2 com carga contínua..."
rm -f "$TMP/parar"; carga & PID=$!
VERSAO=v2 rolar app
sleep 2
touch "$TMP/parar"; wait $PID
falhas=$(wc -l < "$TMP/falhas" | tr -d ' ')
total=$(( $(wc -l < "$TMP/respostas") + falhas ))
ultima=$(tail -1 "$TMP/respostas")
echo "      $total pedidos, $falhas falhados; última resposta: $ultima"
[ "$falhas" -eq 0 ] || { echo "ERRO: houve pedidos falhados durante o rolamento:"; head "$TMP/falhas"; dc logs lb 2>&1 | grep -E "\[(error|warn)\]" | tail -10; exit 1; }
[ "$ultima" = "v2" ] || { echo "ERRO: depois do rolamento esperava v2, veio '$ultima'"; exit 1; }
[ "$(dc ps -q app | wc -l | tr -d ' ')" -eq 2 ] || { echo "ERRO: deviam ficar 2 réplicas"; dc ps; exit 1; }

echo "[3/4] Versão que nunca fica saudável: o rolamento tem de falhar sem paragem..."
rm -f "$TMP/parar"; carga & PID=$!
if VERSAO=v3 FALHAR=1 rolar app; then echo "ERRO: o rolamento de uma versão doente não falhou"; exit 1; fi
sleep 2
touch "$TMP/parar"; wait $PID
falhas=$(wc -l < "$TMP/falhas" | tr -d ' ')
ultima=$(tail -1 "$TMP/respostas")
[ "$falhas" -eq 0 ] || { echo "ERRO: houve pedidos falhados com a versão doente:"; head "$TMP/falhas"; exit 1; }
[ "$ultima" = "v2" ] || { echo "ERRO: a v2 devia continuar a servir, veio '$ultima'"; exit 1; }
[ "$(dc ps -q app | wc -l | tr -d ' ')" -eq 2 ] || { echo "ERRO: os contentores da versão doente não foram removidos"; dc ps; exit 1; }

echo "[4/4] OK — rolamento sem pedidos falhados, e uma versão doente nunca chega a servir."
