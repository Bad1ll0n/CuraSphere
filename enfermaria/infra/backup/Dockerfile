# OPS-04 — imagem do serviço de backup.
#
# O serviço instalava as ferramentas em CADA arranque (`apk add openssl tar age rclone || true`):
# precisava de internet em runtime, as versões mudavam de um arranque para o outro e, se o
# `apk` falhasse, o erro era engolido e a rotina passava a falhar sem cifra nem cópia externa —
# só detectado pelo alerta 26 h depois. Aqui instalam-se no build, e a imagem confirma que
# estão todas antes de existir.
FROM postgres:16-alpine@sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139

RUN apk add --no-cache openssl tar age rclone \
 && openssl version && tar --version >/dev/null && age --version && rclone version >/dev/null && pg_dump --version

# O cron corre como root dentro do contentor (o crond do busybox), mas os scripts escrevem com
# umask 077 e o volume /backups é do host.
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD pgrep crond >/dev/null || exit 1
