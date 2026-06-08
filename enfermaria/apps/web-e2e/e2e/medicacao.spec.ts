import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Medicação e Prescrições', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('painel de medicação existe na página de doente', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    const painelMed = page.getByText(/medicação/i).first();
    await expect(painelMed).toBeVisible({ timeout: 10000 });
  });

  test('botão de nova prescrição está presente para médico', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    // Click on medication tab/section
    const tabMed = page.getByRole('button', { name: /medicação/i }).or(
      page.getByRole('tab', { name: /medicação/i })
    ).first();
    if ((await tabMed.count()) > 0) await tabMed.click();

    await page.waitForTimeout(1000);
    // Prescription button should exist for authorized roles
    const btnPrescrever = page.getByRole('button', { name: /prescrever|nova prescrição|adicionar/i }).first();
    await expect(btnPrescrever).toBeVisible({ timeout: 8000 });
  });

  test('modal de prescrição abre ao clicar em prescrever', async ({ page }) => {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');

    const primeiroDoente = page.locator('a[href*="/doentes/"]').first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');

    const tabMed = page.getByRole('button', { name: /medicação/i }).or(
      page.getByRole('tab', { name: /medicação/i })
    ).first();
    if ((await tabMed.count()) > 0) await tabMed.click();

    await page.waitForTimeout(1000);
    const btnPrescrever = page.getByRole('button', { name: /prescrever|nova prescrição/i }).first();
    if ((await btnPrescrever.count()) === 0) { test.skip(); return; }

    await btnPrescrever.click();

    // A modal/dialog should appear with a medication name input
    await expect(
      page.getByRole('dialog').or(page.locator('[role="dialog"]')).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
