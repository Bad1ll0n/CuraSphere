/**
 * Smoke test por persona — para cada uma das 17 personas de staff da seed
 * (apps/api/src/prisma/seed-test-users.ts), faz login pela UI e navega os itens do
 * menu lateral realmente renderizados para essa role/sub-role/serviço (descobertos no
 * DOM, não hardcoded — o filtro cliente em apps/web/src/app/(dashboard)/client-layout.tsx
 * depende de utilizador.role + .subRole + .servico).
 *
 * Para cada página visitada verifica: sem página em branco, sem error boundary/stack
 * trace visível, sem HTTP 500, sem 403 indevido, e testa um botão de ação segura
 * (abrir modal/filtro) sem submeter nada.
 *
 * RESULTADO (Redis UP): 15/17 personas passam limpas, incluindo as 12 clínicas com MFA.
 * Falham APENAS 00009 (ti) e 00010 (qualidade), ambas no item de menu "Auditoria": clicar
 * "Pesquisar"/render da lista rebenta com `TypeError: Cannot read properties of null (reading
 * 'nome')` porque apps/web/src/app/(dashboard)/(gestao)/auditoria/page.tsx:358-359 acede a
 * `log.utilizador.nome`/`.role` sem optional-chaining, e AuditLog.utilizador é nullable
 * (linhas de origem trigger/system, ou após remoção do utilizador via onDelete:SetNull).
 * Isto é um BUG REAL — ver PERSONA-QA-REPORT.md.
 *
 * NOTA (arquitetura): o anti-replay TOTP do MFA (apps/api/src/app/auth/auth.service.ts:35-46,
 * consumirTotpUmaVez) é FAIL-CLOSED — se o Redis estiver indisponível, `setIfNotExists` devolve
 * `null` e a verificação MFA é SEMPRE rejeitada com 401, bloqueando o login de TODO o staff
 * clínico. Confirmado empiricamente: com o Redis em baixo, estas 12 personas não passavam do
 * login; com o Redis a correr, passam todas. Risco de disponibilidade — ver relatório.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAs } from './helpers';

interface Persona {
  numero: string;
  role: string;
  subRole: string;
  mfa: boolean;
}

const PERSONAS: Persona[] = [
  { numero: '00001', role: 'direcao',       subRole: 'ceo_hospitalar',           mfa: false },
  { numero: '00007', role: 'administrativo', subRole: 'front_desk',              mfa: false },
  { numero: '00008', role: 'operacional',    subRole: 'facilities',              mfa: false },
  { numero: '00009', role: 'ti',             subRole: 'it_admin',                mfa: false },
  { numero: '00010', role: 'qualidade',      subRole: 'quality_manager',         mfa: false },
  { numero: '00002', role: 'medico',         subRole: 'clinico_geral',           mfa: true },
  { numero: '00003', role: 'enfermeiro',     subRole: 'generalista',             mfa: true },
  { numero: '00004', role: 'auxiliar',       subRole: 'apoio_geral',             mfa: true },
  { numero: '00005', role: 'tecnico_saude',  subRole: 'reabilitacao_fisica',     mfa: true },
  { numero: '00006', role: 'farmaceutico',   subRole: 'farmaceutico_hospitalar', mfa: true },
  { numero: '00011', role: 'medico',         subRole: 'medico_gestor',           mfa: true },
  { numero: '00012', role: 'medico',         subRole: 'cardiologista',           mfa: true },
  { numero: '00013', role: 'medico',         subRole: 'neurologista',            mfa: true },
  { numero: '00014', role: 'enfermeiro',     subRole: 'supervisor_enfermagem',   mfa: true },
  { numero: '00015', role: 'enfermeiro',     subRole: 'chefe_enfermeiros',       mfa: true },
  { numero: '00016', role: 'tecnico_saude',  subRole: 'tae',                     mfa: true },
  { numero: '00017', role: 'tecnico_saude',  subRole: 'tec_rad',                 mfa: true },
];

// Máximo de páginas do menu a visitar por persona (mantém o tempo total razoável).
const MAX_LINKS_PER_PERSONA = 10;

const ERROR_BOUNDARY_TEXT = /Algo correu mal|Erro ao carregar|Unhandled Runtime Error|Server Error|Console Error/;
const FORBIDDEN_TEXT = /acesso negado|não tem permissão|forbidden|BREAK_GLASS_REQUIRED/i;
const SAFE_BUTTON_NAME = /^(\+|novo|nova|adicionar|criar|filtrar|exportar|pesquisar|ver detalhe|detalhes?)\b/i;
const HEALTH_CHECK_TIMEOUT = 6000;

async function collectSidebarLinks(page: Page): Promise<{ href: string; text: string }[]> {
  const raw = await page.locator('#sidebar-nav nav a[href^="/"]').evaluateAll((as) =>
    as.map((a) => ({ href: (a as HTMLAnchorElement).getAttribute('href') ?? '', text: (a.textContent ?? '').trim() }))
  );
  const seen = new Set<string>();
  const unique: { href: string; text: string }[] = [];
  for (const l of raw) {
    if (!l.href || seen.has(l.href)) continue;
    seen.add(l.href);
    unique.push(l);
  }
  return unique;
}

async function assertPageHealthy(page: Page, where: string) {
  const bodyText = await page.locator('body').innerText({ timeout: HEALTH_CHECK_TIMEOUT }).catch((e) => `__TIMEOUT__:${e.message}`);
  expect(bodyText.trim().length, `página em branco (ou innerText() não respondeu) em ${where}`).toBeGreaterThan(0);
  await expect(page.getByText(ERROR_BOUNDARY_TEXT).first(), `error boundary visível em ${where}`).toHaveCount(0, { timeout: HEALTH_CHECK_TIMEOUT });
  await expect(page.getByText(FORBIDDEN_TEXT).first(), `403/negação indevida em ${where}`).toHaveCount(0, { timeout: HEALTH_CHECK_TIMEOUT });
}

for (const persona of PERSONAS) {
  test(`persona ${persona.numero} (${persona.role}/${persona.subRole}) — smoke do menu`, async ({ page }) => {
    test.setTimeout(150_000);

    const http500s: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (r) => { if (r.status() >= 500) http500s.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await loginAs(page, persona.numero);

    await expect(page.locator('#sidebar-nav'), 'sidebar não visível após login').toBeVisible({ timeout: 15000 });
    await assertPageHealthy(page, `landing pós-login (${page.url()})`);

    const links = await collectSidebarLinks(page);
    expect(links.length, `sidebar sem nenhum item de menu para ${persona.role}/${persona.subRole}`).toBeGreaterThan(0);

    const toVisit = links.slice(0, MAX_LINKS_PER_PERSONA);
    for (const link of toVisit) {
      await test.step(`menu: ${link.text || link.href} (${link.href})`, async () => {
        await page.goto(link.href);
        await page.waitForLoadState('domcontentloaded');
        await assertPageHealthy(page, link.href);

        // Botão de ação segura: abre modal/filtro/tab, nunca submete.
        const safeButton = page.getByRole('button', { name: SAFE_BUTTON_NAME }).first();
        if (await safeButton.count().catch(() => 0)) {
          const enabled = await safeButton.isEnabled().catch(() => false);
          if (enabled) {
            await safeButton.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
            await assertPageHealthy(page, `${link.href} após clicar em "${await safeButton.innerText().catch(() => '?')}"`);
            await page.keyboard.press('Escape').catch(() => {});
          }
        }

        // Tab de navegação secundária (se existir) — clique não-destrutivo.
        const firstTab = page.getByRole('tab').first();
        if (await firstTab.count().catch(() => 0)) {
          await firstTab.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(300);
          await assertPageHealthy(page, `${link.href} após clicar na 1ª tab`);
        }
      });
    }

    expect(http500s, `HTTP 500 detetados para ${persona.numero}: ${http500s.join(' | ')}`).toEqual([]);
    expect(pageErrors, `erros JS não apanhados para ${persona.numero}: ${pageErrors.join(' | ')}`).toEqual([]);
  });
}
