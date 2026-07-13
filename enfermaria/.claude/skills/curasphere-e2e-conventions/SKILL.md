---
name: curasphere-e2e-conventions
description: Use when writing or running end-to-end (Playwright) or unit (Jest) tests for CuraSphere. Covers the login helper, role fixtures, and existing unit-test mocking style so new tests match the rest of the suite.
---

# CuraSphere — Test Conventions

## E2E (Playwright, `apps/web-e2e/e2e/`)

- Auth helper: `helpers.ts` exports `loginAs(page, role)` where `role` is `'admin' | 'medico' | 'enfermeiro'`. Credentials come from env vars (`TEST_USER`/`TEST_PASSWORD` etc.) with fallback demo logins (`00001`/`Teste1234!` and friends) — these fallbacks assume `seed-test-users.ts` has been run against the target DB.
- Login form is username/password by numeric ID (`Ex: 00001` placeholder), not email — don't assume email-based login in new specs.
- `a11y.spec.ts` exists — accessibility assertions (skip-link focus order, landmark roles) are already covered there; extend it rather than creating a parallel a11y spec file.
- New specs: call `await loginAs(page, role)` first, then drive the flow. Match the existing spec's use of `getByRole`/`getByPlaceholder` over CSS selectors — this codebase prefers accessible-name-based locators, which also doubles as an a11y smoke check.

## Unit tests (Jest, colocated `*.spec.ts` next to source in `apps/api/src/app/**`)

- Prisma is mocked with a hand-built partial object matching the subset of `PrismaService` methods the service under test calls — look at a spec file in the same or a sibling module for the exact shape before introducing a new mocking library.
- New service/controller files should ship with a spec. If you're fixing a bug, add a regression test that fails before the fix and passes after — don't just patch the code.
- Run a single project's tests with `npx nx test api` / `npx nx test web` (see `curasphere-full-verify` for the full gate).

## What NOT to do

- Don't rely solely on a mocked Prisma object when the whole point of a spec is validating a real query/relation shape (e.g. the nullable-unique-constraint or relation-naming issues covered in `curasphere-prisma-schema`) — a mock that doesn't mirror Postgres's actual null-handling semantics can pass while the real query fails. For those cases prefer exercising a real (test) database.
