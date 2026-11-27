# Monitorização, alertas e logs

O objectivo é simples: num hospital, quem descobre que a API caiu, que o disco encheu ou que os
alertas deixaram de chegar não pode ser um enfermeiro no turno da noite.

## Ligar

No `.env.prod`:

```
METRICS_TOKEN=<openssl rand -hex 32>        # a API exige-o em /metrics; o Prometheus usa o mesmo
GRAFANA_ADMIN_PASSWORD=<forte>
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d
```

Configurar **antes** de ligar:

- `monitoring/alertmanager/alertmanager.yml`: destinos dos alertas (email do on-call; ou
  PagerDuty/Opsgenie/SMS para o receiver `on-call`). A password do SMTP vai para
  `monitoring/alertmanager/segredos/smtp_password`, que não fica no repositório.
- `monitoring/prometheus/alvos-externos.yml`: o endereço público real do hospital.

O Grafana fica só em `127.0.0.1:3001` (túnel SSH ou VPN). Nada disto é exposto ao público.

## O que vigia

| Alerta | Condição | Severidade |
|---|---|---|
| `ApiNaoPronta` | `/v1/health/ready` falha há 2 min (BD, migrações ou auditoria) | crítico |
| `WebEmBaixo` / `SitePublicoEmBaixo` | sem resposta há 2 min, por dentro e por fora (DNS, TLS, nginx) | crítico |
| `PostgresEmBaixo` | exporter sem ligação há 1 min | crítico |
| `TaxaDeErros5xx` | mais de 2 % de 5xx em 5 min | crítico |
| `DiscoQuaseCheio` | mais de 80 % num sistema de ficheiros | crítico |
| `BackupAtrasado` / `BackupNuncaRegistado` | último backup com mais de 26 h | crítico |
| `WalNaoArquivado` / `WalSemCopiaExterna` | PITR parado (WAL há mais de 20 min / cópia externa há mais de 30 min) | crítico |
| `BaseBackupAtrasado` | base backup com mais de 8 dias | crítico |
| `LatenciaP95Alta` | p95 acima de 1 s durante 10 min | aviso |
| `EventLoopBloqueado` | atraso p99 do event loop acima de 500 ms | aviso |
| `LigacoesPostgresAltas` | mais de 80 % das ligações em uso | aviso |
| `ContentorReiniciado` | um contentor do CuraSphere reiniciou (autoheal, OOM, crash) | aviso |
| `CertificadoAExpirar` | menos de 14 dias | aviso |
| `CronFalhou` (Loki) | um `@Cron` da API registou erro | aviso |
| `ErrosApiEmRajada` (Loki) | mais de 50 erros em 5 min | aviso |

Os críticos repetem de hora a hora até alguém resolver. Com a BD em baixo, os alertas que
dependem dela ficam inibidos, para não chegar uma avalanche de notificações.

**Objectivos de serviço (SLO):**

- disponibilidade da API de 99,9 % por mês (cerca de 43 min de indisponibilidade);
- p95 da API abaixo de 1 s;
- RPO de 5 min e RTO de 60 min (ver `DR-RUNBOOK.md`).

## Saúde dos serviços

| Endpoint | Para quê |
|---|---|
| `GET /v1/health/live` | Liveness: o processo responde, sem I/O. É o healthcheck do contentor. Se falhar, o `autoheal` reinicia o contentor. |
| `GET /v1/health/ready` | Readiness: BD, nenhuma migração falhada e triggers de auditoria. Usado pelo `deploy.sh` (antes de dar a versão como boa) e pela sonda do Prometheus. `/v1/health` é um alias. |
| `web /api/health` | O servidor Next responde (antes renderizava a página inicial a cada 30 s). |
| `nginx /healthz` | O nginx responde (antes era `nginx -t`, que só valida a sintaxe). |

O Docker sem orquestrador **não** reinicia contentores *unhealthy*. É isso que faz o serviço
`autoheal`, para os contentores com a etiqueta `autoheal=true` (api, web e nginx).

## Logs

Todos os contentores `curasphere-*` são recolhidos pelo **Alloy** e enviados para o **Loki**, com
retenção de 30 dias. Assim sobrevivem a deploys, que recriam os contentores. O Alloy ainda
retira tokens, passwords e cabeçalhos de autorização antes do envio.

- Formato: a API escreve JSON (pino). O nginx escreve JSON com `request_id`, tempos e estado do
  upstream, sem query strings e com o token do link de família mascarado.
- Correlação: o nginx gera `$request_id` e envia-o à API em `X-Correlation-Id`. A API usa-o nos
  logs e na auditoria e devolve-o na resposta, para quem vê um erro poder citar o id ao suporte.
  No Grafana, o campo derivado "Pedido" mostra todas as linhas desse pedido.

Pesquisas úteis (Grafana → Explore → Loki):

```
{servico="api"} | json | level="50"                 # erros da API
{servico="api"} | json | context="Scheduler"         # trabalhos agendados
{servico="nginx"} | json | estado >= 500             # 5xx vistos pelo proxy
{servico=~".+"} |= "<id de correlação>"              # tudo de um pedido
```
