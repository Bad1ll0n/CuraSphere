#!/bin/sh
# OPS-18 — primeira emissão do certificado TLS (Let's Encrypt) para o DOMINIO do .env.prod.
#
# Uso (no host de produção, na raiz do monorepo):
#   ACME_EMAIL=ti@hospital.pt ACEITAR_TERMOS_ACME=sim ./scripts/emitir-certificado.sh
#
# Requisitos: o DOMINIO resolve para este host e a porta 80 chega da Internet (a CA valida pelo
# desafio HTTP-01; ver `acesso_publico` em infra/ansible). Se o hospital usa uma CA interna, não
# corra isto: ponha fullchain.pem, privkey.pem e chain.pem em nginx/ssl/ e TLS_DIR=/etc/nginx/ssl.
#
# Como ainda não há certificado, o nginx (que precisa dele para arrancar) pára alguns segundos e
# o certbot responde ao desafio sozinho (--standalone). Daí em diante o serviço `certbot`
# (perfil acme) renova pelo nginx, sem paragem. ACEITAR_TERMOS_ACME=sim é a aceitação expressa
# dos termos do Let's Encrypt por quem gere o serviço.
set -eu

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.prod}"
dc() { docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" "$@"; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

DOMINIO="${DOMINIO:-$(grep -E '^DOMINIO=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"
[ -n "$DOMINIO" ] || falhar "DOMINIO em falta (no ambiente ou em $ENV_FILE)."
[ -n "${ACME_EMAIL:-}" ] || falhar "ACME_EMAIL em falta (contacto para avisos de expiração do Let's Encrypt)."
[ "${ACEITAR_TERMOS_ACME:-}" = "sim" ] || falhar "Leia os termos do Let's Encrypt (https://letsencrypt.org/repository/) e repita com ACEITAR_TERMOS_ACME=sim."

TESTE=""
[ "${ACME_TESTE:-}" = "sim" ] && TESTE="--test-cert" && echo "(ACME_TESTE=sim: CA de testes do Let's Encrypt — certificado não confiável, só para ensaio)"

echo "[1/3] A parar o nginx para o desafio HTTP-01 (alguns segundos)..."
dc stop nginx >/dev/null 2>&1 || true

echo "[2/3] A pedir o certificado para $DOMINIO..."
if ! dc --profile acme run --rm -p 80:80 --entrypoint certbot certbot certonly \
    --standalone --non-interactive --agree-tos --email "$ACME_EMAIL" \
    --cert-name curasphere -d "$DOMINIO" $TESTE; then
  dc up -d nginx >/dev/null 2>&1 || true
  falhar "o certbot não conseguiu emitir o certificado (DNS de $DOMINIO? porta 80 aberta à Internet?)."
fi

echo "[3/3] A arrancar o nginx e o serviço de renovação..."
dc up -d nginx
dc --profile acme up -d certbot
echo "OK — certificado em /etc/letsencrypt/live/curasphere (volume certbot_conf), renovado automaticamente."
echo "     Confirme no .env.prod: TLS_DIR=/etc/letsencrypt/live/curasphere (é a omissão)."
