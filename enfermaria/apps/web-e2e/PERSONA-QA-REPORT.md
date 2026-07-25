# CuraSphere — Relatório de QA por Persona (Playwright / Chromium)

> QA de UX persona-a-persona. Ambiente: Web http://localhost:3000 · API http://localhost:3333 (`/v1`) · Postgres + Redis **UP** · 17 personas seeded.
> Password partilhada: `Teste1234!` · Segredo TOTP de teste: `EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV`.
> Só foram tocados ficheiros de TESTE (`apps/web-e2e/**`). Nenhum código de produção alterado. Sem commits.

## TL;DR

- **15/17 personas passam o smoke limpas** — incluindo as **12 personas clínicas com MFA** (login MFA a funcionar end-to-end pela UI depois de o Redis subir).
- **2 personas falham**: `00009` (ti) e `00010` (qualidade) — ambas no mesmo sítio, o menu **Auditoria**, por causa de **1 bug real de código** (crash null-`utilizador`).
- **3 bugs reais** encontrados (1 HIGH funcional, 1 HIGH arquitetural de disponibilidade, 1 LOW hidratação) + **1 LOW de acessibilidade**.
- A maioria das falhas da suite e2e **pré-existente** não são bugs de produção: são **testes desatualizados** (placeholder de login mudou), um **overlay de onboarding** que bloqueava cliques em sessão nova (corrigido no helper), e **anti-padrões de teste** (`networkidle` em páginas com polling; chamadas de API contra o baseURL errado).

---

## Ficheiros de teste alterados/criados (apenas testes)

- `apps/web-e2e/e2e/helpers.ts` — **MODIFICADO**: `loginAs` agora (a) aceita qualquer nº de funcionário + password além dos papéis `admin|medico|enfermeiro`; (b) trata o passo MFA gerando TOTP inline (RFC 6238, sem depender de `otplib`, que o pnpm estrito não resolve neste pacote); (c) usa o placeholder atual `Ex: 12345`; (d) fecha o tour de primeira utilização após login. Mantém compatibilidade com os ~40 specs existentes.
- `apps/web-e2e/e2e/persona-smoke.spec.ts` — **NOVO**: smoke das 17 personas (login + navegação do menu real de cada role + verificação de página em branco / error boundary / HTTP 500 / 403 indevido / cliques seguros em botões e tabs).
- `apps/web-e2e/e2e/auth.spec.ts` — **MODIFICADO** (mínimo): atualizado o placeholder desatualizado `Ex: 00001` → `Ex: 12345` e a password default `Admin1234!` → `Teste1234!`.

---

## Prova de login (pedido 1)

- **Sem MFA** — `00001` (direcao): login direto → dashboard. OK.
- **Com MFA** — `00003` (enfermeiro): login → passo TOTP (`getByPlaceholder('000000')`) → botão **"Verificar"** → dashboard. OK.
  O botão do passo MFA chama-se **"Verificar"** (não "Confirmar"); o helper foi ajustado a este seletor (`getByRole('button', { name: 'Verificar' })`).

---

## Tabela persona → áreas testadas → resultado (smoke, Redis UP)

| # | Persona | Role / Sub-role | MFA | Áreas navegadas (menu real) | Resultado |
|---|---|---|---|---|---|
| 1 | 00001 | direcao / ceo_hospitalar | Não | Dashboard exec/TI/qualidade, IA insights, risco clínico, equipamentos, RH, relatórios fin./DGS, tabela atos, conformidade, guidelines | **OK** |
| 2 | 00007 | administrativo / front_desk | Não | Dashboard, doentes-admin, urgência, sala espera, consultas, receção, registos admin, faturação, RH, catálogo | **OK** |
| 3 | 00008 | operacional / facilities | Não | Operacional, equipamentos, tarefas, pedidos internos, dietas, comunicação, férias | **OK** |
| 4 | 00009 | ti / it_admin | Não | Dashboard TI, **Auditoria**, banco sangue, conectores, configurações, equipamentos, guidelines, incidentes/pedidos TI, utilizadores | **FALHA — bug #1 (Auditoria)** |
| 5 | 00010 | qualidade / quality_manager | Não | Dashboard qualidade, IA insights, **Auditoria**, conformidade, eventos adversos, IACS | **FALHA — bug #1 (Auditoria)** |
| 6 | 00002 | medico / clinico_geral | Sim | Dashboard, doentes, urgência, camas, consultas, worklist, interconsultas, MAR-adjacentes, atribuições, passagem turno | **OK** |
| 7 | 00003 | enfermeiro / generalista | Sim | Dashboard, doentes, MAR, camas, urgência, sala espera, atribuições, passagem turno, dietas, banco sangue | **OK** |
| 8 | 00004 | auxiliar / apoio_geral | Sim | Doentes, tarefas, IACS, eventos adversos, camas-adjacentes | **OK** |
| 9 | 00005 | tecnico_saude / reabilitacao_fisica | Sim | Doentes, worklist, fisioterapia, especialidades, horários | **OK** |
| 10 | 00006 | farmaceutico / farmaceutico_hospitalar | Sim | Farmácia, catálogo, fornecedores, farmácia clínica, banco sangue, timeline medicação | **OK** |
| 11 | 00011 | medico / medico_gestor | Sim | Menu clínico completo (como 00002) | **OK** |
| 12 | 00012 | medico / cardiologista | Sim | Menu clínico completo | **OK** |
| 13 | 00013 | medico / neurologista | Sim | Menu clínico completo | **OK** |
| 14 | 00014 | enfermeiro / supervisor_enfermagem | Sim | Menu enfermagem completo | **OK** |
| 15 | 00015 | enfermeiro / chefe_enfermeiros | Sim | Menu enfermagem + IA insights + risco clínico + guidelines (extras do sub-role) | **OK** |
| 16 | 00016 | tecnico_saude / tae | Sim | Doentes, worklist, especialidades | **OK** |
| 17 | 00017 | tecnico_saude / tec_rad | Sim | Doentes, worklist | **OK** |

**Resumo:** 15 personas passaram limpas. 2 falharam, ambas pelo **mesmo** bug de código (Auditoria). As 12 personas clínicas com MFA autenticam e navegam sem problemas.

---

## BUGS REAIS (ordenados por severidade)

### 🔴 BUG #1 — HIGH — Página **Auditoria** rebenta (error boundary) com log de `utilizador` nulo

- **Onde:** rota `/auditoria`. Afeta as roles que têm Auditoria no menu: **ti (00009)** e **qualidade (00010)**. (A rota também é acessível a `direcao`/`administrativo` por `ROLES_AUDITORIA`, mas esses não a têm na sidebar.)
- **Sintoma:** a lista de logs renderiza e, assim que existe **≥1 linha de auditoria com `utilizador = null`**, a página inteira cai no error boundary do dashboard ("**Erro ao carregar / Não foi possível carregar esta secção**"). Confirmado no smoke (00009 e 00010) e reproduzido isoladamente: consola mostra `TypeError: Cannot read properties of null (reading 'nome')` seguido de `[Dashboard Error]`.
- **Causa (ficheiro:linha):** `apps/web/src/app/(dashboard)/(gestao)/auditoria/page.tsx:358-359`
  ```tsx
  <p ...>{log.utilizador.nome}</p>
  <p ...>{roleLabel[log.utilizador.role] ?? log.utilizador.role}</p>
  ```
  Acede a `log.utilizador.nome`/`.role` **sem** optional-chaining. Mas `AuditLog.utilizador` é **nullable** no schema — `apps/api/prisma/schema.prisma:994-995` (`utilizadorId String?` / `utilizador Utilizador? @relation(..., onDelete: SetNull)`), com o próprio comentário do schema a dizer que "uma escrita registada por trigger pode não ter utilizador da app (ex.: SQL direto → 'system')". O sistema de triggers de auditoria (Sessão 73) **produz estas linhas por design**, e `onDelete: SetNull` também as cria quando um utilizador é removido. A função de export na mesma página **já** faz certo (`page.tsx:151-152`: `l.utilizador?.nome ?? '—'`) — só o render é que não.
- **Passos de reprodução:** login `00009` (ti) → menu **Auditoria** → (a lista carrega; basta existir uma linha origem `trigger`/`system` ou de um utilizador removido) → clicar **Pesquisar** → a página troca para o ecrã "Erro ao carregar".
- **Impacto:** a página de Auditoria/compliance — requisito central de um sistema de registos hospitalares com retenção de 6 anos — fica **inutilizável** para TI e Qualidade sempre que existam logs de origem trigger/sistema (que é a situação normal em produção). Fica exposto exatamente quem precisa da auditoria.
- **Correção sugerida (não aplicada):** usar optional-chaining + fallback no render, como já se faz no export: `{log.utilizador?.nome ?? '—'}` e `{log.utilizador ? (roleLabel[log.utilizador.role] ?? log.utilizador.role) : '—'}`. (Alternativa robusta: usar os campos snapshot `utilizadorNome`/`utilizadorRole` que já existem em `AuditLog` — schema:997-998 — precisamente para sobreviver à remoção do utilizador.)

### 🔴 BUG #2 — HIGH (arquitetural, disponibilidade) — MFA **fail-closed** sem Redis bloqueia TODO o staff clínico

- **Onde:** verificação de MFA no login de qualquer persona clínica (roles com `mfaAtivo`: medico, enfermeiro, auxiliar, tecnico_saude, farmaceutico → 00002-00006, 00011-00017).
- **Sintoma:** com o Redis indisponível, **toda** a verificação de código TOTP devolve `401 "Código MFA já utilizado"` e nenhum profissional clínico consegue entrar (nem UI nem API). Comprovado empiricamente nesta sessão: com o Redis em baixo, as 12 personas clínicas não passavam do passo MFA; assim que o Redis subiu, passaram todas.
- **Causa (ficheiro:linha):** `apps/api/src/app/auth/auth.service.ts:35-46` (`consumirTotpUmaVez`) — o anti-replay usa `RedisService.setIfNotExists`, que devolve `null` quando o Redis está down (`apps/api/src/app/redis/redis.service.ts:72-80`). O método trata `null` como **fail-closed** (`return false`), e `verificarMfaLogin` (`auth.service.ts:137-141`) interpreta `false` como "código já usado" → `UnauthorizedException`. Não há degradação graciosa para esta dependência.
- **Passos de reprodução:** parar o Redis → tentar login de qualquer persona clínica com um TOTP válido → 401 em `/v1/auth/mfa/verificar` mesmo com código correto e fresco.
- **Impacto:** o Redis passa a ser um **ponto único de falha para a autenticação de todo o pessoal clínico**. Uma falha do Redis em produção = lockout total de médicos/enfermeiros/etc. Isto é uma escolha de segurança deliberada (preferir negar a permitir replay silencioso de TOTP), mas o trade-off segurança-vs-disponibilidade não está mitigado (sem fallback, sem circuit breaker, sem alerta) e o impacto de disponibilidade é severo num sistema hospitalar. **Achado arquitetural de severidade ALTA** — a decidir conscientemente (ex.: HA no Redis, ou anti-replay com fallback a uma store durável, ou degradar só o anti-replay mantendo a verificação do código).
- **Nota:** já mitigado no ambiente de teste (container `curasphere-redis-dev` a correr); o achado mantém-se para produção.

### 🟡 BUG #3 — LOW — Hidratação inválida no **Portal do Doente** (`<html>/<body>` aninhados)

- **Onde:** `/portal/login` (e todo o segmento `(portal)`).
- **Sintoma:** o browser reporta `A tree hydrated but some attributes... didn't match` (hydration mismatch) na consola ao abrir o portal; em dev o overlay de erro do Next aparece por cima.
- **Causa (ficheiro:linha):** `apps/web/src/app/(portal)/layout.tsx:9-30` renderiza `<html lang="pt"><body>...</body></html>` **dentro** do root layout `apps/web/src/app/layout.tsx:41-53`, que já renderiza `<html><body>`. Resulta em `<html>/<body>` aninhados (HTML inválido) e classes de `<body>` divergentes servidor↔cliente.
- **Impacto:** funcionalmente o portal funciona (o login inválido mostra "Credenciais inválidas" corretamente), mas o HTML é inválido e há custo de hidratação/robustez. Baixo. Nota: dois specs (`portal.spec.ts:10`, `portal-doente.spec.ts:11`) falham em parte por causa disto — o `getByText(/erro|inválid/i)` em strict mode colide com o texto do overlay de dev do Next ("Console Error"); é sobretudo fragilidade de teste, mas a causa-raiz de produção (aninhamento) é real.
- **Correção sugerida (não aplicada):** o layout do portal não deve emitir `<html>`/`<body>` próprios (só o root layout o deve fazer); envolver o conteúdo num `<div>`.

### 🟡 BUG #4 — LOW — Acessibilidade: inputs do login sem associação `label`↔`input`

- **Onde:** `/login` (campos "Número de Funcionário" e "Password").
- **Causa (ficheiro:linha):** `apps/web/src/app/(auth)/login/page.tsx:162-171` (e 175-184) — os `<label>` não têm `htmlFor` e os `<input>` não têm `id` nem estão envolvidos pelo label. Não há associação programática.
- **Impacto:** leitores de ecrã não anunciam o rótulo ao focar o campo; `getByLabel(/número de funcionário/i)` não encontra o campo (é por isto que `auth.spec.ts:27` falha — deixado propositadamente a assinalar a lacuna). WCAG 1.3.1 / 4.1.2. Baixo/médio. (O axe-core não o marca como violação "crítica", daí o a11y.spec passar no login.)
- **Correção sugerida (não aplicada):** adicionar `htmlFor`/`id` correspondentes (ou `aria-label`) aos dois campos.

---

## Limitações de ambiente / testes desatualizados (NÃO são bugs de produção)

### (a) Placeholder do login mudou `Ex: 00001` → `Ex: 12345` — partia specs antigos
- `apps/web/src/messages/pt.json:52` (`employeeNumberPlaceholder: "Ex: 12345"`). O `helpers.ts` e `auth.spec.ts` tinham `Ex: 00001` hardcoded, pelo que **todo** o login pela UI falhava silenciosamente (timeout à procura do placeholder antigo). **Corrigido** no helper e no `auth.spec.ts`.

### (b) Tour de primeira utilização (overlay `z-[100]`) intercepta cliques em sessão nova
- `apps/web/src/components/tour-overlay.tsx:34` é um `<div class="fixed inset-0 ... z-[100]">` que o `client-layout.tsx:101-104` mostra sempre que o `localStorage` não tem `curasphere_tour_<userId>` — ou seja, **sempre** num browser context novo do Playwright. O overlay intercepta pointer events em toda a página; qualquer clique pós-login expira a ~30s (`"<div ...> intercepts pointer events"`). Isto explicava **~metade** das falhas da suite antiga. **Corrigido** no helper (`dismissFirstLoginTour` clica em "Saltar tour" após login). Não é bug de produção (um utilizador real fecha o tour uma vez).

### (c) MFA fail-closed sem Redis (ver BUG #2) — no run inicial, o Redis estava em baixo
- No run inicial da suite (Redis down), todas as falhas de specs que fazem `loginAs('medico'|'enfermeiro')` eram por causa disto (login MFA a dar 401), não por bug da feature: `a11y.spec.ts:26`, `atribuicoes.spec.ts:25`, `bloco.spec.ts:25`, `mar.spec.ts:25`, `worklist.spec.ts:25`, `risco-clinico.spec.ts:25`, `turno.spec.ts:25`, `modulos-clinicos.spec.ts:70` (`mfa 00015: 401`). Com o Redis a correr, deixam de estar bloqueadas. (A causa-raiz em produção está reportada como BUG #2.)

### (d) Anti-padrão `waitForLoadState('networkidle')` em páginas com polling
- Specs que fazem `networkidle` em páginas com polling contínuo nunca resolvem e expiram: `/camas` (long-poll `GET /v1/camas/eventos`, confirmado), `/urgencia` (`refetchInterval` 60s + `setInterval` ETA), `/turno`. Ex.: `camas.spec.ts:9/16/25/34/47`, `urgencia.spec.ts:9/16/25/34/43`, `turno.spec.ts:9`. É fragilidade de teste (usar `domcontentloaded`/espera por seletor em vez de `networkidle`). As próprias páginas renderizam bem — confirmado no persona-smoke (00003/00007 passam por `/camas` e `/urgencia`).

### (e) Specs de API que batem no baseURL errado
- `rbac.spec.ts:62/67` usam `page.request.get('/v1/doentes')` / `page.request.post('/v1/auth/login')`, que resolvem contra o **baseURL do web (`:3000`)**, não a API (`:3333`). Resultado: `404` em vez de `401`, e `loginResponse.ok()` falso. Teste incorreto (deviam usar `http://localhost:3333` ou o `APIRequestContext` com baseURL da API, como faz `regressao-persona.spec.ts`). Não é bug de produção.

### (f) Specs de feature autenticados como `00001` (direcao) a visitar rotas clínicas
- Vários specs fazem `loginAs(page)` (default → `00001`, **direcao**) e depois navegam para rotas que direcao **não** vê no menu (`/doentes`, `/dietas`, etc.), levando a "elemento não encontrado": ex. `dietas.spec.ts:9` (direcao não tem Dietas), `medicacao/notas-clinicas/sinais-vitais` (partem de `/doentes`, que direcao não acede). É desalinhamento persona↔rota nos testes, não bug de produção.

### (g) Redis (limitação de ambiente originalmente indicada) — RESOLVIDO
- Notificações em tempo-real/websockets, locking colaborativo de notas, passkey/WebAuthn, SSO, e cache de respostas AI/guidelines dependem do Redis. No arranque o Redis estava down; foi reposto (`curasphere-redis-dev:6379`) e o ambiente ficou 100% funcional. Nenhuma destas áreas mostrou exceção de código não tratada (só indisponibilidade), por isso não são reportadas como bug.

---

## Execução da suite e2e existente (triagem)

- **Run inicial (Redis down):** 99 passed / 51 failed / 4 skipped. Falhas dominadas por (b) tour-overlay e (c) MFA-sem-Redis.
- **Run após fix do tour no helper (ainda Redis down):** 108 passed / 37 failed / 9 skipped. Falhas restantes = (c) MFA-sem-Redis + (a) placeholder + (d) networkidle + (e) baseURL + (f) persona↔rota + BUG#1/#3.
- **persona-smoke (Redis up):** 15 passed / 2 failed — as 2 falhas = **BUG #1** (Auditoria). As 12 clínicas com MFA passam.

Conclusão da triagem: um único bug funcional de produção (Auditoria), um achado arquitetural HIGH (MFA/Redis), dois LOW (hidratação portal, a11y label). O resto das falhas e2e são testes desatualizados / anti-padrões de teste / a limitação de ambiente do Redis (entretanto resolvida).

---

## Contagem final

- **Personas limpas no smoke:** 15 / 17.
- **Personas com falha:** 2 / 17 (00009, 00010) — mesma causa (BUG #1).
- **Bugs de produção por severidade:** HIGH = 2 (#1 funcional, #2 arquitetural) · LOW = 2 (#3 hidratação, #4 a11y).
- **Categorias de falha de teste (não-bug):** placeholder desatualizado, tour-overlay (corrigido), networkidle em polling, baseURL de API errado, persona↔rota desalinhada, indisponibilidade do Redis (resolvida).
