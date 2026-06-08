import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Sinais Vitais e Scores de Risco', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('painel de sinais vitais existe na página de doente', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }

    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    // Look for Sinais Vitais panel/tab
    const painelSV = page.getByText(/sinais vitais/i).first();
    await expect(painelSV).toBeVisible({ timeout: 10000 });
  });

  test('badge NEWS2 é visível quando há dados', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    // Click on Sinais Vitais tab if needed
    const tabSV = page.getByRole('button', { name: /sinais vitais/i }).or(
      page.getByRole('tab', { name: /sinais vitais/i })
    ).first();
    if ((await tabSV.count()) > 0) await tabSV.click();

    // NEWS2 badge or section should appear (may show "0" or a score)
    await page.waitForTimeout(1500);
    const news2Section = page.getByText(/news2/i).first();
    await expect(news2Section).toBeVisible({ timeout: 8000 });
  });

  test('secção scores de risco (qSOFA/CURB-65) existe', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);
    const scoresSection = page.getByText(/qSOFA|CURB-65|Scores de Risco/i).first();
    await expect(scoresSection).toBeVisible({ timeout: 10000 });
  });
});
