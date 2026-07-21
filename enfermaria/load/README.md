# Testes de carga (k6)

Testes de performance da API CuraSphere com [k6](https://k6.io).

## Correr localmente

Instalar o k6 (`winget install k6` / `brew install k6` / `choco install k6`) e a API a correr
em `http://localhost:3333` com a seed de teste. Depois:

```bash
# smoke — 5 VUs, 30s, com orçamentos de latência (p95 leituras < 500ms)
k6 run load/smoke.js

# rampa — sobe até 50 VUs para encontrar o ponto de degradação
k6 run load/ramp.js

# contra outro ambiente / utilizador
BASE_URL=https://staging.exemplo.pt LOGIN_USER=00001 LOGIN_PASS='...' k6 run load/smoke.js
```

## Thresholds (falham o exit code se excedidos)

| Métrica | Orçamento |
|---|---|
| `http_req_failed` | < 1% (smoke) / < 2% (rampa) |
| `http_req_duration` leituras | p95 < 500ms (smoke) / < 800ms (rampa) |
| `http_req_duration` health | p95 < 150ms |

## CI

O workflow `.github/workflows/load.yml` corre o smoke test sob demanda
(`workflow_dispatch`) e no schedule semanal, contra uma API efémera com Postgres+Redis.
Não corre em cada push (a carga é ruidosa e lenta); é um gate periódico, não de PR.
