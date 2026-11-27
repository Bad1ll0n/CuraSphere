-- SEC-11: o refresh token passa a guardar-se como SHA-256 (hex) do valor entregue ao cliente.
-- Os tokens existentes convertem-se no lugar — as sessões abertas continuam válidas. Um valor
-- de 64 caracteres hex já é um hash (idempotente se a migração for reaplicada à mão).
UPDATE "refresh_tokens"
SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
WHERE "token" !~ '^[0-9a-f]{64}$';
