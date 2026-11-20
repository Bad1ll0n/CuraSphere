# Segredos: configuração, armazenamento e rotação (ARQ-20, OPS-20)

## O que a API exige no arranque

A configuração é validada em `apps/api/src/app/config/esquema-config.ts`. Em produção
(`NODE_ENV=production`), a API **não arranca** se:

- faltar `ALLOWED_ORIGINS`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `AUDIT_SIGNING_KEY` ou
  `MEDICACAO_QR_SECRET`;
- a `ENCRYPTION_KEY` não tiver **exatamente** 64 caracteres hexadecimais (antes, uma chave com 128
  passava na validação e desligava a cifragem em silêncio);
- um segredo tiver um valor de exemplo (`ALTERAR…`, `CHANGE_ME…`, `placeholder`…);
- dois segredos forem iguais. Cada um (`JWT_SECRET`, `ENCRYPTION_KEY`, `AUDIT_SIGNING_KEY`,
  `QUIOSQUE_SECRET`, `MEDICACAO_QR_SECRET`, `METRICS_TOKEN`, `HL7_API_TOKEN`) tem de ser próprio;
- `QUIOSQUE_SECRET`, `HL7_API_TOKEN` (32+) ou `METRICS_TOKEN` (24+) estiverem definidos mas
  forem curtos.

Gerar um segredo: `openssl rand -hex 32`. Gerar o par ES256 dos tokens: ver `.env.example`.

## Segredos em ficheiros, não no ambiente

Qualquer segredo pode vir de um ficheiro, com `<NOME>_FILE` (por exemplo Docker/Kubernetes
secrets em `/run/secrets/…`). Assim não fica em claro no `.env` nem no ambiente do contentor, onde
aparece em `docker inspect`. Exemplo no compose:

```yaml
services:
  api:
    environment:
      ENCRYPTION_KEY_FILE: /run/secrets/encryption_key
    secrets: [encryption_key]
secrets:
  encryption_key:
    file: ./segredos/encryption_key   # chmod 600, fora do repositório
```

Definir `NOME` e `NOME_FILE` ao mesmo tempo é um erro de arranque. A lista dos segredos aceites
está em `apps/api/src/carregar-segredos.ts`.

## Rotação

| Segredo | Como rodar | Efeito para os utilizadores |
|---|---|---|
| `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` | Gerar um par novo, atualizar a API e o web, reiniciar | Sessões ativas recusadas uma vez: os utilizadores voltam a entrar (os refresh tokens são opacos e continuam válidos) |
| `ENCRYPTION_KEY` | Procedimento abaixo, sem perder dados | Nenhum |
| `AUDIT_SIGNING_KEY` | Selar um checkpoint, trocar a chave e reiniciar. Os checkpoints antigos verificam-se com a chave antiga, que fica guardada fora da BD | Nenhum |
| `MEDICACAO_QR_SECRET` | Trocar e reiniciar; reimprimir as etiquetas em uso | As etiquetas antigas deixam de validar |
| `QUIOSQUE_SECRET` | Trocar, reiniciar e gerar tokens novos para cada quiosque | Os quiosques param até receberem um token novo |
| `METRICS_TOKEN`, `HL7_API_TOKEN` | Trocar na API e no consumidor (Prometheus, HIS) ao mesmo tempo | Falhas de recolha ou de mensagens HL7 durante a troca |
| Password da BD | `ALTER ROLE … PASSWORD`, atualizar `DATABASE_URL` e reiniciar | Nenhum |

### Rodar a `ENCRYPTION_KEY`

A chave cifra o nome do doente, os contactos, a morada, o NIF, a semente TOTP e o segredo dos
webhooks. Também deriva os índices cegos da pesquisa por nome e NIF.

1. Gerar a nova: `openssl rand -hex 32`.
2. Configurar `ENCRYPTION_KEY=<nova>` e `ENCRYPTION_KEYS_ANTERIORES=<antiga>` e reiniciar a API.
   - Tudo o que foi cifrado com a antiga continua a ler-se (o AES-GCM diz qual é a chave certa).
   - A pesquisa por nome e NIF procura também nos índices antigos.
   - O que se escreve a partir daqui vai com a nova.
3. Contar: `cd apps/api && npx ts-node --transpile-only src/prisma/rodar-chave-cifragem.ts --simular`.
4. Recifrar: o mesmo comando, sem `--simular`. É retomável; repetir até dizer 0.
5. Retirar `ENCRYPTION_KEYS_ANTERIORES` e reiniciar.
6. Destruir a chave antiga **depois** de expirarem os backups cifrados com ela (ver o runbook de
   backups); até lá, guardá-la no cofre de segredos.
