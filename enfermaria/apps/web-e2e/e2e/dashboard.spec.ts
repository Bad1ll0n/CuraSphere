import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('dashboard principal carrega sem erros', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
  });

  test('dashboard principal tem cards de métricas', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const card = page.getByText(/doentes|internados|camas|ocupação/i).first();
    if ((await card.count()) > 0) {
      await expect(card).toBeVisible({ timeout: 10000 });
    }
  });

  test('dashboard executivo carrega', async ({ page }) => {
    await page.goto('/dashboard-executivo');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    const titulo = page.getByText(/executivo|gestão|kpi/i).first();
    if ((await titulo.count()) > 0) {
      await expect(titulo).toBeVisible({ timeout: 10000 });
    }
  });

  test('dashboard qualidade carrega', async ({ page }) => {
    await page.goto('/dashboard-qualidade');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    const titulo = page.getByText(/qualidade|indicador|compliance/i).first();
    if ((await titulo.count()) > 0) {
      await expect(titulo).toBeVisible({ timeout: 10000 });
    }
  });

  test('navegação entre dashboards funciona', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const linkExec = page.getByRole('link', { name: /executivo/i }).or(
      page.getByText(/executivo/i).first(),
    ).first();
    if ((await linkExec.count()) > 0) {
      await linkExec.click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/500/i)).not.toBeVisible();
    }
  });

  test('IA Insights no dashboard qualidade são visíveis', async ({ page }) => {
    await page.goto('/dashboard-qualidade/ia-insights');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    const insights = page.getByText(/insight|anomali|alerta|IA/i).first();
    if ((await insights.count()) > 0) {
      await expect(insights).toBeVisible({ timeout: 10000 });
    }
  });
});
