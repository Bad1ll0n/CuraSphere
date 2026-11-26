# Migrações do schema (ARQ-11)

O schema deixou de ser aplicado com `prisma db push`. Cada alteração passa a ser uma
**migração SQL versionada** em `prisma/migrations/`, revista no PR e aplicada uma única vez,
pela ordem, com `prisma migrate deploy`.

## No dia-a-dia (desenvolvimento)

```sh
cd apps/api
# 1. editar prisma/schema.prisma
# 2. gerar a migração (cria prisma/migrations/<data>_<nome>/migration.sql e aplica-a à BD de dev)
pnpm exec prisma migrate dev --name descricao_curta
# 3. rever o SQL gerado ANTES do commit — sobretudo DROP, ALTER TYPE e NOT NULL sem default
```

- Nunca editar uma migração que já esteja em `main`: corrige-se com uma migração nova.
- Alterações destrutivas (renomear ou apagar colunas) fazem-se em dois passos: acrescentar →
  migrar os dados → remover numa versão seguinte.
- O CI aplica todas as migrações a uma base vazia e compara com o `schema.prisma`
  (passo "Migrações batem certo com o schema"): schema alterado sem migração falha o PR.

## Deploy

O serviço `migrate` do `docker-compose.prod.yml` corre `prisma migrate deploy` e depois
`scripts/apply-audit-triggers.mjs` (idempotente — acrescenta os triggers às tabelas novas).

## Transição de uma BD criada com `db push` (uma única vez, por ambiente)

A primeira migração (`20261105000000_baseline`) descreve o schema que já existia em produção
quando se passou a usar migrações. Numa base criada por `db push`, essas tabelas já existem —
marca-se a baseline como aplicada em vez de a correr:

```sh
cd apps/api
# 0. backup (scripts/backup-db.sh) — sempre antes de mexer no schema
# 1. confirmar que a BD está igual à baseline (deve dizer "No difference detected"):
git show <commit-da-baseline>:enfermaria/apps/api/prisma/schema.prisma > /tmp/schema-baseline.prisma
pnpm exec prisma migrate diff --from-config-datasource --to-schema /tmp/schema-baseline.prisma --script
#    se houver diferenças, aplicá-las primeiro:  ... --script > /tmp/acerto.sql
#                                                 pnpm exec prisma db execute --file /tmp/acerto.sql
# 2. marcar a baseline como aplicada
pnpm exec prisma migrate resolve --applied 20261105000000_baseline
# 3. aplicar o resto
pnpm exec prisma migrate deploy && node scripts/apply-audit-triggers.mjs
```

Depois disto, o deploy normal (`migrate deploy`) trata de tudo.

## Valores permitidos e dinheiro (ARQ-22)

- Os campos de estado/tipo guardados como texto têm um `CHECK` na BD com os valores de
  `libs/shared/src/lib/dominios.ts` (a fonte única, usada também pelos DTOs). Para acrescentar um
  valor: na lista partilhada, no comentário do campo no schema e numa migração nova
  (`ALTER TABLE … DROP CONSTRAINT ck_… ; ALTER TABLE … ADD CONSTRAINT ck_… CHECK (…) NOT VALID;`).
  O teste `common/schema-modelacao.spec.ts` falha se os três divergirem.
- Os `CHECK` entram como `NOT VALID`: valem para tudo o que se escreve a partir daí, sem que a
  migração falhe por linhas antigas. Depois do deploy, em cada ambiente:

  ```sql
  -- linhas fora do domínio (corrigir antes de validar), por exemplo:
  SELECT tipo, count(*) FROM tickets WHERE tipo NOT IN ('admissao','consulta','faturacao','farmacia','exames','urgencia','geral') GROUP BY 1;
  -- e depois:
  ALTER TABLE tickets VALIDATE CONSTRAINT ck_tickets_tipo;
  ```

- O dinheiro é `DECIMAL(12,2)`. A aritmética passa por `common/dinheiro.ts` (ao cêntimo), e o
  `Decimal` serializa em JSON como número, por isso o contrato da API não muda.
