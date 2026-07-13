---
name: curasphere-full-verify
description: Use before declaring any CuraSphere backend or frontend change complete. Runs the full verification gate (typecheck, build, unit tests, lint) across the affected Nx projects (api, web, mobile) and reports pass/fail per step. Use this as the final gate on any task that touched apps/api, apps/web, or apps/mobile.
---

# CuraSphere — Full Verification Gate

CuraSphere is an Nx monorepo (`enfermaria/`) with projects `api`, `api-e2e`, `web`, `web-e2e`, `mobile`. Nx infers `typecheck`, `build`, `test`, `lint` targets per project from `@nx/js/typescript`, `@nx/webpack`, `@nx/jest` plugins in `nx.json` — there are no custom root `package.json` scripts, everything runs through `nx`.

## Steps (run from `enfermaria/` root)

1. **Typecheck** the projects you touched:
   ```
   npx nx typecheck api
   npx nx typecheck web
   npx nx typecheck mobile
   ```
   Zero errors is the bar. Do not ignore `any`-related or implicit-any errors — this codebase is strict-mode TS.

2. **Build**:
   ```
   npx nx build api
   npx nx build web
   ```
   A green typecheck does not guarantee a green build (Next.js does extra static-analysis/prerendering work). Always build `web` after touching any page/route file.

3. **Unit tests** (Jest, `*.spec.ts` colocated with source):
   ```
   npx nx test api
   npx nx test web
   ```
   If you added or changed a service/controller, there should be a matching `.spec.ts`. Look at a sibling spec file in the same directory for the mocking convention (Prisma is normally mocked with a hand-rolled partial mock object, not `jest-mock-extended`, unless the file already imports it).

4. **E2E** (only when the change touches a user-facing flow covered by existing specs — see the `curasphere-e2e-conventions` skill):
   ```
   npx nx e2e web-e2e
   npx nx e2e api-e2e
   ```
   These need the dev servers running; check `apps/web-e2e/playwright.config.ts` / `apps/api-e2e` config for `webServer` auto-start before assuming you need to start `start-api.bat` / `start-web.bat` yourself.

5. **Lint**:
   ```
   npx nx lint api
   npx nx lint web
   ```

If `npx nx show projects` doesn't list the expected project name, project names may differ slightly from the directory name — run it once to confirm before assuming.

## Reporting

Report each step as PASS/FAIL with the actual error output for failures, not a paraphrase. If a step fails for a pre-existing reason unrelated to your change (verify with `git stash` + rerun, or `git blame` the failing line), say so explicitly rather than silently ignoring it — pre-existing failures still block "100% functional" claims and should be flagged up, not swept under the rug.
