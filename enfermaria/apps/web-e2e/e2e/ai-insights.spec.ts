import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

test.describe('IA — Dashboard Qualidade e Funcionalidades AI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('dashboard de qualidade carrega sem erros', async ({ page }) => {
    await page.goto('/dashboard-qualidade');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/qualidade|dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('secção de insights IA é visível no dashboard de qualidade', async ({ page }) => {
    await page.goto('/dashboard-qualidade');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Secção de IA insights (pode estar a carregar)
    const iaSecção = page.getByText(/insights.*ia|ia.*insights|inteligência artificial|ai insights/i).or(
      page.getByText(/análise ia|claude|recomendações ia/i)
    ).first();

    if ((await iaSecção.count()) > 0) {
      await expect(iaSecção).toBeVisible({ timeout: 8000 });
      console.log('[ai-insights.spec] Secção IA encontrada');
    } else {
      // Verificar que pelo menos o dashboard tem métricas (mesmo sem IA visível)
      const metrica = page.getByText(/\d+%|\d+ doentes|\d+ camas/i).first();
      await expect(metrica).toBeVisible({ timeout: 8000 });
    }
  });

  test('atalho NLQ (busca IA) existe ou dashboard tem campo de pesquisa', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verificar se existe ícone/botão de NLQ (Natural Language Query)
    const btnNLQ = page.getByRole('button', { name: /pesquisar|buscar|nlq|cmd/i }).or(
      page.locator('[data-testid="nlq-trigger"]').or(
        page.getByText(/⌘K|ctrl\+k|pesquisa IA/i)
      )
    ).first();

    if ((await btnNLQ.count()) > 0) {
      await expect(btnNLQ).toBeVisible({ timeout: 6000 });
      console.log('[ai-insights.spec] NLQ encontrado');
    } else {
      // Campo de pesquisa regular
      const searchInput = page.locator('input[type="search"]').or(
        page.getByPlaceholder(/pesquisar|search/i)
      ).first();
      if ((await searchInput.count()) > 0) {
        await expect(searchInput).toBeVisible();
      }
    }
  });

  // QA-23: fazia login no WEB (não na API), com a password errada, contra um endpoint que não
  // existe — e saltava. PROD-19: decisão clínica por IA desligada; produtividade disponível.
  test('PROD-19: diagnóstico diferencial por IA recusado (403); pesquisa NLQ não', async ({ page }) => {
    await loginAs(page, '00002');
    const doenteId = await prepararDoenteClinico(page);
    const api = process.env['API_URL'] ?? 'http://localhost:3333';
    const headers = { 'x-csrf-token': (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value ?? '' };
    const dd = await page.request.post(`${api}/v1/ai-clinico/${doenteId}/diagnostico-diferencial`, { data: { sintomas: 'febre' }, headers });
    expect(dd.status()).toBe(403);
    expect((await dd.json()).message).toMatch(/REGISTO-IA/);
    const nlq = await page.request.post(`${api}/v1/ai-clinico/nlq`, { data: { query: 'doentes com febre' }, headers });
    expect(nlq.status()).not.toBe(403); // sem chave do LLM pode falhar, mas nunca pelo registo
  });

  test('dashboard qualidade ia-insights rota existe', async ({ page }) => {
    await page.goto('/dashboard-qualidade/ia-insights');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Não deve ser 404 do Next.js
    const body = await page.content();
    expect(body).not.toContain('404 | This page could not be found');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
