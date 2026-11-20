#!/bin/sh
# OPS-18 — o certbot renova o certificado no volume partilhado; o nginx só o lê ao (re)carregar.
# Recarrega de 6 em 6 horas (sem paragem): um certificado renovado entra em vigor no máximo 6 h
# depois, muito antes de o anterior expirar (o certbot renova a 30 dias do fim).
( while sleep 21600; do nginx -t -q && nginx -s reload; done ) >/dev/null 2>&1 &
