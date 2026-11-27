---
name: curasphere-prisma-schema
description: Use whenever editing apps/api/prisma/schema.prisma or adding a new Prisma model in CuraSphere. Covers the versioned-migrations workflow (prisma migrate dev / deploy), nullable-unique-constraint gotchas, relation naming collisions, and the PII encryption middleware field list.
---

# CuraSphere — Prisma Schema Changes

## Versioned migrations (since 2026-11 — ARQ-11)

Schema changes are **versioned SQL migrations** in `apps/api/prisma/migrations/`. `db push` is no
longer used anywhere (dev, CI or production). From `apps/api/`:
```
pnpm exec prisma migrate dev --name short_description   # creates + applies the migration
```
Review the generated `migration.sql` before committing (DROP / ALTER TYPE / NOT NULL without default).
Never edit a migration that is already on `main` — add a new one. Production runs
`prisma migrate deploy` (service `migrate` in docker-compose.prod.yml) followed by the audit triggers
script. CI applies all migrations to an empty DB and fails if they don't match `schema.prisma`.
Details and the one-off baseline procedure: `apps/api/prisma/MIGRACOES.md`.

The generated client (`apps/api/src/generated/`) is **not in git** (ARQ-10): it is produced by the Nx
target `@org/api:prisma-generate`, which build/typecheck/test/lint depend on.

Clinical history must survive: relations from `Utilizador`/`Doente` use `onDelete: Restrict`
(ARQ-03, enforced by `estrutura.spec.ts`); clinical records are soft-deleted with
`deletedAt` + `removidoPorId` + `motivoRemocao` and every read filters `deletedAt: null` (ARQ-04).

`prisma.config.ts` exists in `apps/api/` — check it before assuming the default `schema.prisma` location/datasource.

## Gotchas already hit in this codebase

1. **Nullable field in a `@@unique` compound constraint breaks `upsert`.** Postgres treats `NULL != NULL`, so a unique index on `(data, turno, servicoId)` where `servicoId` can be null does not enforce uniqueness for null rows, and Prisma's `upsert` can't target it reliably either. Pattern used instead: drop the `@@unique`, and in the service do `findFirst({ where: {...} })` then conditionally `create` or `update`. See `AiStaffingPrevisao` for the reference case.

2. **Relation field name collisions on `Utilizador`.** `Utilizador` accumulates relations from many domains (stock transfers, external hospital transfers, cohorts, wellbeing, rules, etc.). Before naming a new back-relation field (e.g. `transferenciasSolicitadas`), grep the `Utilizador` model block for the name first — it's a large, long-lived model and collisions are the most common schema-edit error here. When a collision exists, prefix with a short domain tag (e.g. `transExternasSolicitadas` vs. the pre-existing `transferenciasSolicitadas` for stock).

3. **PII encryption middleware has a hardcoded field allowlist.** `apps/api/src/app/prisma/encryption.middleware.ts` only encrypts fields listed in `ENCRYPTED_FIELDS` (currently `Doente: ['nome','contacto','morada']`, `Contacto: ['nome','telefone','email']`). If you add a new PII-bearing field to `Doente`/`Contacto`, or a new model that stores patient PII, update `ENCRYPTED_FIELDS` too — the middleware does **not** infer PII fields automatically. `ENCRYPTION_KEY` is a required Joi env var (64-hex-char) validated at boot in `app.module.ts`; there's no silent no-op path anymore.

4. **pgvector may not be installed.** `guidelines_clinicas.embedding` is a real `vector(1536)` column, but `GuidelinesService` probes availability at `OnModuleInit` (`pgvectorDisponivel` flag) and falls back to JS cosine similarity over the JSON-encoded `embeddingJson` column when the extension isn't present. If you touch vector search, preserve both paths — don't assume pgvector is there. Setup script: `apps/api/prisma/pgvector-setup.sql`.

## Adding a new model checklist

- Add the model block, `@@map("snake_case_table_name")`.
- Add both sides of any relation (on the model and on whatever it points to — `Doente`, `Utilizador`, etc.).
- Run `pnpm exec prisma migrate dev --name <name>` from `apps/api/` and review the SQL.
- If the model holds patient PII beyond what's already covered, update the encryption middleware allowlist (point 3 above).
- Register the consuming module in `app.module.ts` (see `curasphere-nestjs-module` skill).
