#!/bin/sh
# OPS-18/OPS-19 — corre antes de o nginx arrancar (docker-entrypoint.d). Falha cedo e com uma
# mensagem clara em vez de um nginx que arranca sem domínio, sem redes ou sem certificado.
set -eu
falta() { echo "CURASPHERE: $*" >&2; exit 1; }
[ -n "${DOMINIO:-}" ] || falta "DOMINIO em falta no .env.prod (o server_name do nginx)."
[ -f /etc/nginx/rede-interna.conf ] || falta "nginx/rede-interna.conf em falta — copiar de nginx/rede-interna.conf.example e ajustar às redes do hospital."
for f in fullchain.pem privkey.pem chain.pem; do
  [ -s "${TLS_DIR}/$f" ] || falta "${TLS_DIR}/$f em falta — emitir com scripts/emitir-certificado.sh (Let's Encrypt) ou pôr o certificado da CA interna em nginx/ssl/ com TLS_DIR=/etc/nginx/ssl."
done
