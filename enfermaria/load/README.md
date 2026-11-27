# Testes de carga (k6)

Testes de performance da API CuraSphere com [k6](https://k6.io).

## O que medem (PERF-09)

Três cenários em paralelo, sobre uma BD com volume (`seed-volume.ts`):

| Cenário | Quem | O que faz |
|---|---|---|
| `turno` | enfermeiro 00003 (com MFA) | lista os seus doentes (filtro de atribuição do turno), abre a ficha e os sinais vitais, lê as notificações, pesquisa por nome e **regista sinais vitais** (CSRF, auditoria, NEWS2) |
| `supervisao` | direção 00001 | pesquisa por nome (índice cego) e percorre a lista paginada de todos os internados |
| `tempo_real` | enfermeiro 00003 | abre ligações Socket.IO (`/ws`) com bilhete, mantém-nas 5 s e responde aos pings |

As `checks` contam para o resultado (`checks: rate>0.99`): uma resposta 200 com a lista vazia ou
uma escrita recusada fazem o teste falhar.

## Correr localmente

1. API a correr em `http://localhost:3333` contra uma BD com as migrações, os triggers de auditoria e as duas seeds:

   ```bash
   cd apps/api
   npx ts-node --transpile-only src/prisma/seed-test-users.ts
   SEED_DOENTES=500 npx ts-node --transpile-only src/prisma/seed-volume.ts
   ```

2. Com o k6 instalado (`winget install k6` / `brew install k6`) ou pela imagem oficial:

   ```bash
   k6 run load/smoke.js     # 30 s, 10 VUs
   k6 run load/ramp.js      # 3 min: até 50 VUs no turno e 40 sockets
   # sem instalar: docker run --rm -v "$PWD/load:/load" -e BASE_URL=http://host.docker.internal:3333 -e SUMMARY_PATH=/load/k6-summary.json grafana/k6 run /load/smoke.js
   ```

Variáveis: `BASE_URL`, `LOGIN_PASS`, `TEST_TOTP_SECRET` (o segredo fixo das contas de teste), `SUMMARY_PATH`.
Cada execução faz um login com TOTP por conta; duas execuções seguidas dentro dos mesmos 30 s
são recusadas pelo anti-replay do MFA. Se isso acontecer, espere pela janela seguinte.

## Orçamentos (falham o exit code se excedidos)

| Métrica | smoke | rampa |
|---|---|---|
| `checks` | > 99% | > 98% |
| `http_req_failed` | < 1% | < 2% |
| leituras p95 | < 500 ms | < 800 ms (p99 < 1,5 s) |
| pesquisa p95 | < 600 ms | < 1 s |
| escritas p95 | < 800 ms | < 1,2 s |
| `ws_ligou` (sockets que entram no namespace) | > 99% | > 98% |

O sumário completo fica em `k6-summary.json` (artefacto no CI).

## CI

`.github/workflows/load.yml` corre o smoke às segundas-feiras e sob demanda (`workflow_dispatch`,
com a escolha `smoke`/`ramp`), contra uma API efémera em `NODE_ENV=production` com Postgres e
Redis. Não corre em cada push: a carga é ruidosa e lenta. É um gate periódico, não de PR.
