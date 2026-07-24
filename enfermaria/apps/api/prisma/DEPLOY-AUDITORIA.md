# Runbook de deploy — Auditoria tamper-proof

> **Quando usar:** ao promover a auditoria por triggers para **staging** (primeiro) e depois
> **produção**. Todos os passos abaixo são de ambiente/infra — **não** se fazem em dev local
> (onde o Postgres é superuser e não há WORM, por isso os grants e a ancoragem não têm efeito).
>
> **Regra de ouro (sistema clínico):** validar tudo em **staging** ponta-a-ponta **antes** de
> produção. Nunca ativar direto em prod.

---

## 0. Antes do dia do deploy (fazer já)

- [ ] **Gerar `AUDIT_SIGNING_KEY`** e guardá-la no secret manager (não na BD, não no git).
  ```bash
  openssl rand -hex 32
  ```
  **Porquê agora:** checkpoints assinados com uma chave **não verificam** com outra. Fixar a
  chave **antes** do primeiro checkpoint real ser selado evita ter de re-sedar histórico.
  Enquanto não estiver definida, o boot emite `ERROR` (o tamper-proof contra insider fica inativo).

- [ ] **Criar o papel não-superuser da app** (ex.: `curasphere_app`) e apontar a `DATABASE_URL`
  de produção para esse papel — **não** para `postgres`. Sem isto, os grants WORM do passo 4
  não restringem nada (um superuser ignora-os).

---

## 1. Ordem no dia do deploy

A ordem **importa** — foi desenhada para nunca deixar uma escrita sem auditoria (um *buraco* é
pior que *duplicados* transitórios).

```
1. Secrets prontos:  AUDIT_SIGNING_KEY  +  papel não-superuser + DATABASE_URL a apontar-lhe
2. Migrar schema:    prisma db push        (cria/atualiza tabelas + AuditLog/AuditCheckpoint/AcessoLeitura)
3. Aplicar triggers: pnpm --filter @org/api audit:triggers        ← ANTES do código novo
4. Deploy do código novo                                          ← pára os duplicados do interceptor antigo
5. Grants WORM:      psql ... -f prisma/audit-grants.sql          (com o papel não-superuser)
6. Ancoragem + rigor: AUDIT_ANCHOR_FILE → WORM  +  track_commit_timestamp=on
7. Verificar:        GET /audit/checkpoints/verificar  →  { ok: true }
```

**Porque 3 antes de 4:** aplicar os triggers **antes** de trocar o código garante que nenhuma
escrita passa sem auditoria. Há um breve intervalo em que o código **antigo** (que ainda audita
no interceptor) coexiste com os triggers → gera **duplicados** temporários — aceitáveis e
removíveis. O inverso (código novo primeiro, triggers depois) abriria um **buraco** de escritas
não auditadas. Nunca inverter.

---

## 2. Comandos (referência)

### 2.1 Migrar schema + aplicar triggers
```bash
# a partir da raiz do monorepo, com a DATABASE_URL de destino no ambiente
pnpm --filter @org/api exec prisma db push
DATABASE_URL="$DATABASE_URL" pnpm --filter @org/api audit:triggers
```
`audit:triggers` é **idempotente** (`DROP TRIGGER IF EXISTS` + `CREATE`), aplica a **todas** as
tabelas base menos a deny-list (`audit_logs`, `audit_checkpoints`, `acessos_leitura`).
**Tem de correr após CADA `prisma db push`** — os triggers não estão no schema Prisma.

### 2.2 Grants WORM (separação de deveres)
```bash
psql "$DATABASE_URL" -v app_role=curasphere_app -f apps/api/prisma/audit-grants.sql
```
Corre como owner/superuser, **depois** do db push + triggers. Concede à app `INSERT,SELECT` e
revoga `UPDATE,DELETE,TRUNCATE` sobre `audit_logs`/`audit_checkpoints` (append-only). A retenção
(fim dos 6 anos) é feita por um papel **separado** e privilegiado, com dupla autorização — nunca
pelo papel da app.

### 2.3 Variáveis de ambiente
| Variável | Efeito | Obrigatória em prod |
|---|---|---|
| `AUDIT_SIGNING_KEY` | assina as raízes dos checkpoints (tamper-proof vs insider) | **Sim** |
| `AUDIT_ANCHOR_FILE` | caminho append-only (JSONL) dos checkpoints → enviar p/ WORM | Recomendada |
| `AUDIT_CHECKPOINT_MS` | intervalo de selagem (default 60000) | Não |
| `DATABASE_URL` | **tem de** usar o papel não-superuser | **Sim** |

### 2.4 Rigor total da ordem (opcional, recomendado)
```sql
-- postgresql.conf  (requer restart do cluster)
track_commit_timestamp = on
```
Permite trocar a margem temporal de segurança (`MARGEM_SEG`, hoje 60s) por um watermark exato
por ordem-de-commit. Sem isto o sistema é correto — apenas usa uma janela de segurança.

---

## 3. Verificação pós-deploy (staging e prod)

- [ ] Boot **sem** `ERROR`/`WARN` de `AUDIT_SIGNING_KEY` (chave definida).
- [ ] `GET /audit/checkpoints/verificar` → `{ ok: true, ... }`.
- [ ] Uma escrita pela app (ex.: admitir doente) gera linha em `audit_logs` com o **utilizador**
  correto (id/nome/role/ip) e `origem = 'trigger'`.
- [ ] Um `UPDATE` direto por SQL regista `utilizadorId = null` / `'system'` (completude) e guarda
  **só nomes** de colunas alteradas — **nunca** valores (sem PII).
- [ ] Grants ativos: a app **não** consegue `DELETE`/`UPDATE` em `audit_logs`
  (`ERROR: permission denied`).
- [ ] Uma leitura de ficha (`GET /doentes/:id`) aparece em `acessos_leitura` (quem viu que ficha).
- [ ] Ancoragem: o ficheiro `AUDIT_ANCHOR_FILE` recebe uma linha JSONL por checkpoint e é enviado
  para o WORM.

---

## 4. Reversão

Os triggers são aditivos e removíveis sem tocar nos dados de negócio:
```sql
-- remover todos os triggers de auditoria (não apaga audit_logs)
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT event_object_table FROM information_schema.triggers
           WHERE trigger_name='curasphere_audit'
  LOOP EXECUTE format('DROP TRIGGER IF EXISTS curasphere_audit ON %I', t); END LOOP;
END $$;
```
O código novo tolera a ausência de triggers (deixa de auditar por trigger; nada quebra). Para
reverter o código, redeploy do build anterior. Os dados de `audit_logs` mantêm-se intactos.

---

## 5. Decisão de desenho a conhecer

A atribuição de **escritas de campo único** (fora de `$transaction`) é, por opção, **opt-in**
via `PrismaService.escritaAuditada(fn)` — **não** há auto-wrap de todas as escritas (mexer nisso
arriscava a interação encriptação↔transação↔delegates e a fuga de PII). As **ações clínicas
críticas** (prescrever, administrar, admitir, alta, transfusão, break-glass, acesso a ficha) são
**compostas → já atribuídas**. Escritas de campo único são **registadas** (completude) como
`system`. Fechar esta lacuna é um trabalho dedicado e cuidadoso, não um passo de deploy.
