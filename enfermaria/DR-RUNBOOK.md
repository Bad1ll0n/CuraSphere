# Runbook de Disaster Recovery — CuraSphere

Recuperação da plataforma clínica CuraSphere após perda de dados, corrupção, ransomware ou
falha de infraestrutura. Consolida os mecanismos que já existem no repositório
([`scripts/backup-db.sh`](scripts/backup-db.sh), [`scripts/restore-db.sh`](scripts/restore-db.sh),
[`docker-compose.prod.yml`](docker-compose.prod.yml), [`apps/api/prisma/DEPLOY-AUDITORIA.md`](apps/api/prisma/DEPLOY-AUDITORIA.md))
numa sequência de recuperação testável.

> **Regra de ouro**: um backup nunca testado é uma esperança, não um backup. Ver §6 (drills).

---

## 1. Objetivos (RPO / RTO)

| Componente | Estado atual | Objetivo | Como fechar a lacuna |
|---|---|---|---|
| **RPO** (perda máxima) | **24 h** (pg_dump noturno às 02:00) | ≤ 15 min | Ativar WAL archiving + PITR (base backup + WAL contínuo) |
| **RTO** (tempo até repor) | ~30–60 min (provisionar + restaurar dump) | ≤ 60 min | Manter infra-as-code + este runbook ensaiado |

O backup noturno está em [`docker-compose.prod.yml`](docker-compose.prod.yml) (serviço `backup`,
cron `0 2 * * *`, retenção 30 dias). Para RPO apertado, ver §7.

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
Serviço `backup` no compose de produção: `pg_dump | gzip` diário às 02:00, apaga backups > 30 dias.

### 3.2 Manual (antes de qualquer operação de risco)
```sh
# a partir da raiz do monorepo, com DB_* no ambiente (ou .env.prod)
./scripts/backup-db.sh          # → ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### 3.3 Verificar que os backups são válidos (não assumir)
```sh
# integridade do gzip
gzip -t ./backups/backup_*.sql.gz
# o backup mais recente não está vazio nem truncado
ls -lh ./backups/ | tail -3
```
**Off-site**: copiar `./backups/` (e os segredos) para uma região/conta diferente — um backup no
mesmo host que a BD não sobrevive à perda desse host nem a ransomware.

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
./scripts/restore-db.sh ./backups/backup_20260726_020000.sql.gz   # ou um específico
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

Um restauro nunca ensaiado não conta. A cada trimestre:
1. Provisionar uma BD **staging/scratch** (nunca prod).
2. `DB_HOST=staging ./scripts/restore-db.sh` com o backup de produção mais recente.
3. Correr o checklist do §5 contra staging.
4. Cronometrar (valida o RTO) e registar a data/resultado do drill.
5. Testar também o restauro dos **segredos** e do **object storage**, não só da BD.

---

## 7. Cenários de falha

| Cenário | Ação |
|---|---|
| **Perda/corrupção da BD** | §4.2 (restaurar dump) → §4.4 (triggers) → §5. RPO até 24 h. |
| **Perda do object storage** | §4.3 (repor bucket). BD intacta; ficheiros indisponíveis degradam graciosamente. |
| **Perda total do host/região** | Provisionar nova região → §4 completo a partir dos backups off-site + segredos. |
| **Ransomware / adulteração** | Restaurar do backup off-site imutável **anterior** ao incidente; `GET /audit/integridade` localiza a primeira entrada adulterada (auditoria append-only + checkpoints assinados). |
| **`ENCRYPTION_KEY` perdida** | PII irrecuperável. Prevenção > cura: **backup dedicado da chave** no gestor de segredos, com o seu próprio DR. |
| **Melhorar o RPO** | Ativar WAL archiving contínuo + PITR (`archive_command` → object storage; base backup periódico). Reduz RPO de 24 h para minutos. |

---

## 8. Contactos e escalonamento
Preencher por instalação: on-call de infra, DBA, responsável de segurança/DPO (obrigatório para
incidentes com PII — RGPD), e o gestor de segredos onde vivem `ENCRYPTION_KEY`/`AUDIT_SIGNING_KEY`.

---

*Manter este runbook vivo: revê-lo a cada drill e sempre que a topologia (BD, object storage,
segredos) mudar.*
