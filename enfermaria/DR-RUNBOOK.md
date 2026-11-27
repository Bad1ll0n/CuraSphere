# Runbook de Disaster Recovery — CuraSphere

Recuperação da plataforma clínica CuraSphere após perda de dados, corrupção, ransomware ou
falha de infraestrutura. Consolida os mecanismos que já existem no repositório
([`scripts/backup-db.sh`](scripts/backup-db.sh), [`scripts/restore-db.sh`](scripts/restore-db.sh),
[`docker-compose.prod.yml`](docker-compose.prod.yml), [`apps/api/prisma/DEPLOY-AUDITORIA.md`](apps/api/prisma/DEPLOY-AUDITORIA.md))
numa sequência de recuperação testável.

> **Regra de ouro**: um backup nunca testado é uma esperança, não um backup. Ver §6 (drills).

---

## 1. Objetivos (RPO / RTO)

| Componente | Estado atual | Objetivo | Como |
|---|---|---|---|
| **RPO** (perda máxima) | **≤ 5 min** com PITR (WAL arquivado a cada segmento, no máximo a cada 5 min; cópia cifrada fora do host a cada 5 min). Sem PITR: 24 h (dump diário) | ≤ 15 min | §4.6, alertas `WalNaoArquivado` / `WalSemCopiaExterna` |
| **RTO** (tempo até repor) | **53 s** de restauro + recuperação medidos com 5 M linhas (base backup cifrado de 154 MB e 60 segmentos de WAL; §6.1). Com a base real, medir no próximo ensaio | ≤ 60 min | §4.6, ensaio automático mensal (§6) |

Três camadas, independentes umas das outras:

- **PITR**: base backup físico semanal (domingo 03:00, `scripts/basebackup.sh`) mais WAL contínuo (`scripts/arquivar-wal.sh` + `scripts/enviar-wal.sh`). Repõe qualquer instante.
- **Dump lógico diário** às 02:00 (`scripts/backup-all.sh`). É o recurso se o arquivo físico tiver um problema, e serve também para restaurar só uma parte.
- **Cópias fora do host, cifradas**, em `BACKUP_REMOTE` (base, WAL e dumps).


---

## 2. O que tem de existir para recuperar (inventário)

A recuperação **completa** exige TRÊS coisas independentes. Faltar uma torna as outras inúteis.

1. **Base de dados PostgreSQL** — todo o processo clínico, prescrições, auditoria.
   Backup: `pg_dump` gzip em `./backups/` (nightly + manual).

2. **Armazenamento de objetos (S3 / MinIO)** — **NÃO está no dump da BD**. Contém:
   documentos de saúde, imagens DICOM, fotografias de doentes, PDFs de carta de alta.
   Backup: versionamento do bucket + replicação cross-region (`S3_BUCKET`). Ver §4.3.

3. **Segredos / variáveis de ambiente** — **NÃO devem estar no dump da BD**. Sem eles, os
   backups são irrecuperáveis ou inúteis:
   | Segredo | Consequência de perda |
   |---|---|
   | `ENCRYPTION_KEY` (64-hex) | **PII dos doentes (nome/contacto/morada) fica ilegível para sempre** — encriptada em repouso. Irrecuperável mesmo com o dump. |
   | `AUDIT_SIGNING_KEY` | Checkpoints de auditoria antigos deixam de ser verificáveis (perde-se a prova de integridade). |
   | `JWT_SECRET` | Todas as sessões/refresh tokens invalidam (utilizadores voltam a autenticar — aceitável). |
   | `DB_PASSWORD`, `S3_*` | Sem acesso à BD / object storage restaurados. |

   **Guardar os segredos num gestor de segredos (Vault/AWS Secrets Manager/1Password), fora da BD
   e fora do repositório, com o seu próprio backup.** A `ENCRYPTION_KEY` é o item mais crítico do
   sistema inteiro: trate-a como as chaves de um cofre.

**Redis** é efémero (cache, sessões, adaptador socket.io, throttle, contadores de lockout) — **não
precisa de backup**. Após recuperação: utilizadores voltam a autenticar e os contadores de
brute-force reiniciam (aceitável).

---

## 3. Backups — operação e verificação

### 3.1 Automático
Serviço `backup` no compose de produção, diário às 02:00 (`scripts/backup-all.sh`):
1. `pg_dump` da base → **cifrado em pipe** (nunca em claro no disco) → `backup_*.sql.gz.age` (ou `.enc`);
2. `tar` dos uploads (anexos, DICOM, PDFs) → cifrado → `uploads_*.tar.gz.age` (ou `.enc`);
3. cópia de ambos para `BACKUP_REMOTE` (rclone, `--immutable`), se definido;
4. retenção local de `RETENCAO_DIAS` (30).

**Cifra (OPS-01)** — obrigatória; sem ela a rotina falha (`scripts/backup-cifra.sh`):
- **age (recomendado):** `BACKUP_AGE_RECIPIENT=age1…` (chave pública). A chave **privada**
  (`age-keygen -o curasphere-backup.key`, gerada noutra máquina) vive no cofre, **nunca** no host.
- **openssl:** `BACKUP_ENCRYPTION_KEY` (`openssl rand -hex 32`), também guardada fora do host.
- Só em desenvolvimento: `BACKUP_PERMITIR_EM_CLARO=sim`.

### 3.2 Manual (antes de qualquer operação de risco)
```sh
# a partir da raiz do monorepo, com DB_* no ambiente (ou .env.prod)
./scripts/backup-db.sh          # → ./backups/backup_YYYYMMDD_HHMMSS.sql.gz.age (ou .enc)
```

### 3.3 Verificar que os backups são válidos (não assumir)
Com age, o host de produção **não consegue** verificar o conteúdo (não tem a chave privada) —
valida só o formato. A verificação a sério é o **ensaio de restauro**, mensal, numa base scratch:
```sh
BACKUP_AGE_IDENTITY=/cofre/curasphere-backup.key DB_HOST=scratch DB_NAME=ensaio   RESTAURO_NAO_INTERATIVO=sim ./scripts/restore-db.sh
```
**Fora do host (OPS-01):** `BACKUP_REMOTE` (ex.: `b2:curasphere-backups`) com o rclone configurado em
`./backup-remoto/rclone.conf`. Requisitos do destino:
- outra região/conta/fornecedor;
- **Object Lock** (modo compliance, retenção ≥ 30 dias) — o ransomware que cifre o host não
  consegue apagar nem reescrever as cópias;
- credenciais **só de escrita** (sem delete) no `rclone.conf` do host.

Um backup no mesmo host que a BD não sobrevive à perda desse host nem a ransomware: sem
`BACKUP_REMOTE` o log da rotina avisa todos os dias.

---

## 4. Sequência de recuperação (ordem importa)

> **Antes de tocar em produção**: confirmar o alvo. `restore-db.sh` é **destrutivo** — sobrescreve
> `DB_NAME@DB_HOST`. Nunca correr contra prod sem intenção explícita.

### 4.1 Provisionar infraestrutura
1. Levantar Postgres 16, Redis 7, object storage e a app (via `docker-compose.prod.yml` ou IaC).
2. Injetar **todos** os segredos do §2.3 no ambiente (do gestor de segredos). Validados no boot
   (Joi em `app.module.ts`) — a app **recusa arrancar** sem `ENCRYPTION_KEY`/`DATABASE_URL`.

### 4.2 Restaurar a base de dados
```sh
# alvo confirmado via DB_HOST/DB_NAME no ambiente
./scripts/restore-db.sh                       # usa o backup mais recente em ./backups
./scripts/restore-db.sh ./backups/backup_20260726_020000.sql.gz.age   # ou um específico
# backups cifrados: BACKUP_AGE_IDENTITY=<chave privada> (age) ou BACKUP_ENCRYPTION_KEY (openssl)
```

### 4.3 Restaurar o armazenamento de objetos
- Repor o bucket S3/MinIO a partir da réplica/versionamento (`S3_BUCKET`).
- Se a BD foi restaurada para um ponto anterior ao object storage (ou vice-versa), há URLs de
  ficheiros na BD sem objeto correspondente — a app degrada graciosamente (documento indisponível),
  não quebra. Registar a divergência para reconciliação.

### 4.4 Reaplicar / verificar os triggers de auditoria (append-only)
O dump `pg_dump` inclui triggers e funções, mas **confirmar** que a auditoria tamper-proof está
ativa (ver [`DEPLOY-AUDITORIA.md`](apps/api/prisma/DEPLOY-AUDITORIA.md)):
```sh
node apps/api/scripts/apply-audit-triggers.mjs   # idempotente; reaplica se faltar
```
Isto reinstala os triggers append-only em todas as tabelas clínicas e mantém a lista DENY
(`audit_logs`, `audit_checkpoints`, `acessos_leitura`, `totp_consumidos`, `cron_locks`).

### 4.6 Restaurar para um instante (PITR) — o caminho normal

Usar sempre que se sabe **quando** o problema começou: uma corrupção, um `DELETE` errado, um
ransomware detectado às 14:32. Repõe a base no estado de um segundo antes, num volume NOVO, sem
tocar no que está a correr.

```sh
# 1. O base backup mais recente ANTERIOR ao instante, e o WAL desde então (local ou do remoto):
ls backups/base_*                                   # ou: rclone copy $BACKUP_REMOTE/base/... .
docker run --rm -v curasphere_wal_arquivo:/w alpine tar -cf - -C /w . | tar -xf - -C /tmp/wal
#    (do remoto: rclone copy $BACKUP_REMOTE/wal/ /tmp/wal — os .age/.enc são decifrados pelo script)

# 2. Restaurar até ao instante (UTC). Sem instante: até ao último WAL disponível.
BACKUP_AGE_IDENTITY=/cofre/curasphere-backup.key \
  ./scripts/restaurar-pitr.sh backups/base_20261101_030000.tar.gz.age /tmp/wal "2026-11-06 14:31:00+00"
#    → volume curasphere_pgdata_restaurado_<data>, e a duração (RTO) no fim.
```

3. Verificar o volume restaurado (§5) com um contentor PostgreSQL temporário.
4. Pôr em serviço: parar `api`/`web`, apontar o serviço `postgres` para o volume restaurado
   (`docker-compose.prod.yml`, `volumes:` do `postgres`), arrancar, §4.4 e §5.

Se o PostgreSQL de restauro disser *recovery ended before configured recovery target was
reached*, falta WAL entre o base backup e o instante pedido: trazer os segmentos em falta do
remoto. Esta recusa é intencional: o PostgreSQL nunca entrega um estado anterior ao pedido
como se fosse o pedido.

### 4.5 Apontar a app e arrancar
Reiniciar a API/web contra a BD e object storage restaurados. A eleição de líder dos crons
(advisory-lock + `cron_locks`) recupera automaticamente; o adaptador Redis do socket.io religa
(fail-safe se o Redis ainda não estiver pronto).

---

## 5. Verificação pós-recuperação (checklist obrigatório)

Não declarar recuperado sem passar TODOS:

- [ ] **Login + MFA** funciona (prova JWT/BD).
- [ ] **PII de um doente decifra** no detalhe do doente (prova que a `ENCRYPTION_KEY` é a correta —
      se aparecer texto cifrado/ilegível, a chave está errada: **parar** e corrigir a chave, não os dados).
- [ ] **Integridade da auditoria**: `GET /v1/audit/integridade` devolve `ok: true` (cadeia de hash
      intacta; aponta a primeira quebra se não).
- [ ] **Object storage**: abrir um documento/imagem de um doente.
- [ ] **Escrita clínica** (ex.: registar sinal vital) grava e **audita** (a auditoria não pode quebrar escritas).
- [ ] **Contagens sanidade**: nº de doentes/utilizadores/prescrições coerente com o esperado.
- [ ] **Crons**: um cron adquire liderança (log `tryBecomeLeader`); sem duplicação entre instâncias.

---

## 6. Drills de DR (trimestral — obrigatório)

**Automático, todos os meses** (`.github/workflows/ensaio-dr.yml`, e em cada PR que mexa nos
scripts): `scripts/ensaio-pitr.sh` monta um PostgreSQL descartável com o arquivo de WAL de
produção, faz um base backup cifrado, escreve antes e depois de um instante T, destrói a base,
restaura até T e **prova** que o anterior a T está lá e o posterior não. A duração fica no
resumo da execução. Localmente: `ENSAIO_LINHAS=5000000 ./scripts/ensaio-pitr.sh`.

Este ensaio prova o mecanismo, mas não a base real. Por isso, uma vez por trimestre:
1. Provisionar uma BD **staging/scratch** (nunca prod).
2. `DB_HOST=staging ./scripts/restore-db.sh` com o backup de produção mais recente.
3. Correr o checklist do §5 contra staging.
4. Cronometrar (valida o RTO) e registar a data/resultado do drill.
5. Testar também o restauro dos **segredos** e do **object storage**, não só da BD.

### 6.1 Registo de drills

| Data | Âmbito | Resultado | Tempos | Executado por |
|---|---|---|---|---|
| 2026-09-03 | Base de dados (dev → scratch descartável) | **Passou** | backup 1 s (2,0 MB) · restauro 2 s · restauro sobre base já povoada 3 s · total 8 s | Correcção pós-auditoria |
| 2026-11-06 | PITR ponta a ponta (`ensaio-pitr.sh`, 200 000 linhas) | **Passou** | estado exacto em T (500 linhas antes de T presentes, 300 depois ausentes) · restauro + recuperação 6 s | Plano de melhoria, Fase 1 (OPS-02) |
| 2026-11-06 | PITR ponta a ponta (`ensaio-pitr.sh`, 5 000 000 linhas) | **Passou** | base backup cifrado 154 MB · 60 segmentos de WAL · estado exacto em T · restauro + recuperação **53 s** | Plano de melhoria, Fase 1 (OPS-02) |

**O que este drill provou.** As 140 tabelas foram repostas na íntegra e os **135 triggers de
auditoria vieram com o restauro** — a cadeia à prova de adulteração sobrevive a uma
recuperação, que é o que interessa num sistema onde o registo de quem acedeu a que processo
é requisito legal. E o restauro correu uma segunda vez **sobre a base já povoada**: é
exactamente o caso que falhava antes, porque o `pg_dump` não usava `--clean --if-exists` e o
`psql` abortava no primeiro `relation already exists`. Numa recuperação real a base nunca
está vazia — o Postgres cria-a já com o schema `public`, ou tem restos da tentativa anterior.

**O que este drill NÃO provou, e é preciso dizer:**

- **Foi feito contra a base de desenvolvimento**, com 2,0 MB. Os tempos acima não se
  extrapolam para produção: com dados reais o restauro é dominado pela reconstrução dos
  índices, e cresce muito mais depressa do que o tamanho do dump. **O RTO só fica conhecido
  quando este mesmo ensaio correr contra um dump de produção.**
- **Não testou o restauro dos segredos nem do object storage** (passos 5 do §6). Sem
  `ENCRYPTION_KEY` a base restaurada é ilegível na parte cifrada, e sem os ficheiros clínicos
  o registo volta com referências a anexos que não existem.
- **Não testou provisionamento de máquina**. O ensaio correu contra um Postgres já a
  funcionar; num desastre real o tempo de pôr a máquina de pé vem antes disto e não está
  medido.

**Como repetir** (não interactivo, para poder correr em CI):

```sh
RESTAURO_NAO_INTERATIVO=sim DB_NAME=<scratch> ./scripts/restore-db.sh <ficheiro.sql.gz>
```


---

## 7. Cenários de falha

| Cenário | Ação |
|---|---|
| **Perda/corrupção da BD** | §4.6 (PITR até ao instante antes do problema) → §4.4 (triggers) → §5. RPO de minutos. Se o arquivo físico falhar: §4.2 (dump diário, RPO até 24 h). |
| **Perda do object storage** | §4.3 (repor bucket). BD intacta; ficheiros indisponíveis degradam graciosamente. |
| **Perda total do host/região** | Provisionar nova região → §4 completo a partir dos backups off-site + segredos. |
| **Ransomware / adulteração** | Restaurar do backup off-site imutável **anterior** ao incidente; `GET /audit/integridade` localiza a primeira entrada adulterada (auditoria append-only + checkpoints assinados). |
| **`ENCRYPTION_KEY` perdida** | PII irrecuperável. Prevenção > cura: **backup dedicado da chave** no gestor de segredos, com o seu próprio DR. |
| **Erro humano (ex.: `DELETE` em massa)** | §4.6 para um volume novo, até um segundo antes; extrair dali os registos apagados e reinseri-los, sem repor a base inteira. |

---

## 8. Contactos e escalonamento
Preencher por instalação: on-call de infra, DBA, responsável de segurança/DPO (obrigatório para
incidentes com PII — RGPD), e o gestor de segredos onde vivem `ENCRYPTION_KEY`/`AUDIT_SIGNING_KEY`.

---

*Manter este runbook vivo: revê-lo a cada drill e sempre que a topologia (BD, object storage,
segredos) mudar.*
