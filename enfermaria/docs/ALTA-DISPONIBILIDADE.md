# Alta disponibilidade e deploy sem paragem (OPS-09)

Este documento descreve o que existe hoje, o que continua a ser um ponto único de falha (SPOF) e
qual é o caminho para o eliminar. Não promete o que não está feito.

## 1. O que existe

| Camada | Estado | Onde |
|---|---|---|
| **API** | `API_REPLICAS` réplicas (omissão: 2) atrás do nginx. Uma réplica que cai ou fica *unhealthy* não leva o serviço; o `autoheal` reinicia-a. | `docker-compose.prod.yml` (`deploy.replicas`) |
| **Web (Next.js)** | `WEB_REPLICAS` réplicas (omissão: 2), idem. | idem |
| **Balanceamento** | nginx, `least_conn`, `max_fails=1 fail_timeout=5s`, `proxy_connect_timeout 2s`, repetição noutra réplica em erro de ligação. O nginx só vê a rede `curasphere-lb`. | `nginx/nginx.conf` |
| **Deploy** | Rolamento sem paragem: as réplicas novas arrancam ao lado das antigas, fora do balanceamento, e só entram depois de passarem a prontidão (`/v1/health/ready`). Uma versão doente nunca recebe pedidos e a versão anterior continua a servir. | `scripts/deploy.sh`, `scripts/lib-rolamento.sh` |
| **Ensaio** | Pedidos contínuos durante o rolamento, com zero falhados exigidos, mais o caso da versão doente. Corre no CI (workflow "Ensaio DR") em cada PR que mexa em scripts, nginx ou compose. | `scripts/ensaio-rolamento.sh` |
| **Estado partilhado entre réplicas** | Socket.IO com adaptador Redis; eventos SSE (camas, tarefas, fila da receção, urgência) pelo barramento Redis; revogação de sessões e feature flags difundidas a todas as réplicas; limites de pedidos (throttler) contados no Redis; `@Cron` e verificações periódicas (SLA da urgência, tarefas urgentes) com eleição de líder. | `redis/barramento.service.ts`, `common/throttler-redis.storage.ts`, `prisma.service.ts#tryBecomeLeader` (ARQ-17) |
| **Paragem ordenada** | A API termina os pedidos em curso antes de sair (`enableShutdownHooks`, `stop_grace_period: 30s`). | `apps/api/src/main.ts` |

### Como funciona o rolamento

1. Criam-se N contentores novos com `--scale --no-recreate --no-start`, tiram-se da rede `curasphere-lb` e só então arrancam. O nginx não os vê.
2. Espera-se que fiquem saudáveis (liveness) e prontos (readiness). Se algum falhar, os novos são removidos e o deploy termina com erro. **Não há paragem nem reversão a fazer**, porque os antigos nunca saíram.
3. Os novos entram na rede `curasphere-lb` com o nome do serviço. Confirma-se que o DNS do Docker os devolve ao nginx e faz-se `nginx -s reload`, que é gracioso: os workers antigos terminam os pedidos em curso.
4. Os antigos recebem SIGTERM e terminam os pedidos em curso. Depois são removidos e o nginx é recarregado de novo.

**Porque não se usa `server ... resolve` no nginx.** No ensaio, o nginx manteve os IPs antigos na zona partilhada mesmo depois de recarregar, e houve pedidos perdidos. A resolução no carregamento da configuração, combinada com as recargas do rolamento, é determinística.

**Regra para as migrações.** Durante o rolamento, as duas versões servem ao mesmo tempo, por isso as alterações de schema têm de ser aditivas (expandir → migrar → contrair). Já era a regra do rollback; com réplicas passa a ser obrigatória.

**Recriar contentores à mão.** Se `api` ou `web` forem recriados fora do `deploy.sh` (por exemplo, com `docker compose up -d` depois de mudar uma variável), é preciso correr a seguir `docker compose exec nginx nginx -s reload`. Sem isso, o nginx pode manter IPs antigos (OPS-12).

## 2. O que continua a ser ponto único de falha

| SPOF | Consequência | RPO / RTO actuais |
|---|---|---|
| **O host** (uma máquina) | Avaria do host = serviço em baixo até repor noutro. | RPO ≤ 5 min (PITR com WAL fora do host), RTO medido de restauro da BD 53 s + provisionamento (ver `DR-RUNBOOK.md`) |
| **PostgreSQL** (uma instância) | Reiniciar ou avariar a BD = API não pronta. | idem |
| **Redis** (uma instância, sem persistência obrigatória) | O tempo real e as caches degradam para o modo local de cada réplica. Não há perda de dados clínicos. O throttler cai para a contagem por réplica. | n/a (estado efémero) |
| **nginx** (um contentor) | Reinício em segundos (`autoheal`); sem réplica, sem IP flutuante. | segundos |

## 3. Caminho para eliminar os SPOF (por ordem de valor)

1. **Réplica em espera do PostgreSQL (streaming replication, hot standby) noutro host**, alimentada pelo WAL que já é arquivado. Promoção manual documentada no runbook. Isto baixa o RTO de "provisionar + restaurar" para "promover" (minutos) e o RPO para segundos. Ferramenta recomendada a seguir: Patroni + etcd, para promoção automática.
2. **Segundo host aplicacional** com o mesmo compose (sem BD), atrás de um IP flutuante (keepalived/VRRP) ou do balanceador do hospital. Os pré-requisitos da aplicação já estão tratados (secção 1).
3. **Redis Sentinel** (3 nós). Só compensa depois do ponto 2.
4. **Orquestrador** (Kubernetes, ou Nomad em alternativa). Só quando houver mais de dois hosts. O compose + `lib-rolamento.sh` chega para um ou dois.

Cada passo tem de ser ensaiado como o PITR e o rolamento: um failover nunca testado é uma esperança.
