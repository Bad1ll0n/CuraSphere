---
name: curasphere-persona-matrix
description: Use when driving a live persona-based test of CuraSphere (web dashboard, patient portal, or family access) via Playwright. Lists every test persona, its credentials, and exactly how to get past login (including MFA) for each actor type.
---

# CuraSphere — Persona Matrix for Live Persona Testing

All personas below come from `apps/api/src/prisma/seed-test-users.ts` (staff + patient + family fixtures) run against a local dev database. Re-run it any time to reset to a known state: `cd apps/api && npx ts-node src/prisma/seed-test-users.ts` (requires `DATABASE_URL` set — check `apps/api/.env`; this **truncates and rebuilds** the `utilizadores` table, so don't run it against a database anyone is using for something else).

Shared test password for every staff and portal account: **`Teste1234!`**

## Staff personas (web dashboard, login at `/login` with employee number + password)

| # | Role | Sub-role | Employee # | MFA required? |
|---|---|---|---|---|
| 1 | direcao | ceo_hospitalar | 00001 | No |
| 2 | administrativo | front_desk | 00007 | No |
| 3 | operacional | facilities | 00008 | No |
| 4 | ti | it_admin | 00009 | No |
| 5 | qualidade | quality_manager | 00010 | No |
| 6 | medico | clinico_geral | 00002 | **Yes** |
| 7 | enfermeiro | generalista | 00003 | **Yes** |
| 8 | auxiliar | apoio_geral | 00004 | **Yes** |
| 9 | tecnico_saude | reabilitacao_fisica | 00005 | **Yes** |
| 10 | farmaceutico | farmaceutico_hospitalar | 00006 | **Yes** |
| 11 | medico | medico_gestor | 00011 | **Yes** |
| 12 | medico | cardiologista | 00012 | **Yes** |
| 13 | medico | neurologista | 00013 | **Yes** |
| 14 | enfermeiro | supervisor_enfermagem | 00014 | **Yes** |
| 15 | enfermeiro | chefe_enfermeiros | 00015 | **Yes** |
| 16 | tecnico_saude | tae | 00016 | **Yes** |
| 17 | tecnico_saude | tec_rad | 00017 | **Yes** |

The 7 sub-role personas (11-17) exist because these specific sub-roles change real permissions/guards in the API (see `SUBROLES` in `apps/api/src/app/common/enums.ts`) — they're not just cosmetic labels. Test them separately from their base-role counterpart when the task is about permission boundaries; testing just the base role is enough when the task is about a feature all of that role's variants share.

### Logging in as a staff persona

1. Go to `/login`, enter the employee number and `Teste1234!`.
2. **If MFA is required** (roles 6-17 above): the login response is `mfaSetupObrigatorio` on first-ever use of a given seeded account in this DB, or `mfaPendente` on subsequent logins — both need a 6-digit TOTP code. All clinical personas share one fixed test secret: `EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV`. Generate the current valid code with:
   ```bash
   cd apps/api && node -e "require('otplib').generate({secret:'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV'}).then(c=>console.log(c))"
   ```
   Run this immediately before entering the code — TOTP codes are time-windowed (~30s validity). If the UI shows a QR code for first-time setup, you don't need to scan it — just enter the code computed from the secret above; the backend verifies the code against whatever secret you tell it during setup, but this seed pre-configures `mfaAtivo: true` with the secret already known, so most personas go straight to the `mfaPendente` (verify-only) path, not the setup path.
3. Once past login (and MFA if applicable), you're in the dashboard scoped to that role/sub-role — the sidebar (`nav-data.tsx`-driven) shows only what that persona can access. Discover it by looking at what's actually rendered, not by reading the source.

## Patient portal persona

- URL: `/portal/login`
- Email: `doente.teste@curasphere.local`
- Password: `Teste1234!`
- No MFA. Scoped entirely to one seeded test patient ("Doente de Teste (Persona)", `numeroProcesso: TESTE-PORTAL-001`) — everything reachable from here should be about that one patient's own documents/medication/PRO/messages, never another patient's data.

## Family access persona

- No login — a direct, token-bearing URL: `/familia/<token>`.
- The current token is printed by the seed script's last run — re-run it if you need a fresh one (`npx ts-node src/prisma/seed-test-users.ts`, the `ACESSO FAMÍLIA` line in the output) since old tokens expire after 7 days.
- This persona never authenticates as a "user" in the normal sense — it's a scoped, time-limited read view of one patient for a family contact. Test that it can't do anything beyond viewing (no mutation actions should be reachable), and that the link stops working after `ativo:false`/expiry.

## What NOT to do while testing as any persona

- Don't actually trigger real external side effects — if a "send message"/"send email"/"send SMS" action is about to actually dispatch through a configured provider (Resend, Twilio, etc.), stop short of the final send and note that you verified the compose/validation flow instead. Check `apps/api/.env` for whether those provider keys are actually configured in this dev environment before assuming a send is inert.
- Don't perform truly irreversible actions on shared seed data beyond what's expected for testing (e.g. don't permanently discharge/delete the one shared test patient if other personas are still being tested against it in the same pass) unless the scenario specifically calls for it.
- Do perform realistic, reversible actions relevant to the persona's job (create a note, record a vital sign, register a task) — a real user would do this, and it's how you find real bugs; just be mindful that this is a shared fixture, not a private sandbox, if multiple persona tests are expected to run against the same seeded data in sequence.
