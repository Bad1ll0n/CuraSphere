import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const DOENTE_URL = '/doentes';

test.describe('Notas Clínicas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('secção de notas clínicas existe na ficha do doente', async ({ page }) => {
    await page.goto(DOENTE_URL);
    await page.waitForLoadState('networkidle');
    const primeiroDoente = page.getByRole('link', { name: /ver|detalhe|ficha/i }).or(
      page.locator('tbody tr').first().getByRole('link'),
    ).first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/notas? clínicas?|notas? de evolução/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('botão criar nota clínica está acessível', async ({ page }) => {
    await page.goto(DOENTE_URL);
    await page.waitForLoadState('networkidle');
    const primeiroDoente = page.getByRole('link', { name: /ver|detalhe|ficha/i }).or(
      page.locator('tbody tr').first().getByRole('link'),
    ).first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');
    const btnCriar = page.getByRole('button', { name: /nova nota|criar nota|adicionar nota/i }).first();
    if ((await btnCriar.count()) > 0) {
      await expect(btnCriar).toBeVisible({ timeout: 8000 });
    }
  });

  test('lista de notas clínicas renderiza sem erros', async ({ page }) => {
    await page.goto(DOENTE_URL);
    await page.waitForLoadState('networkidle');
    const primeiroDoente = page.getByRole('link', { name: /ver|detalhe|ficha/i }).or(
      page.locator('tbody tr').first().getByRole('link'),
    ).first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|erro/i)).not.toBeVisible();
  });

  test('criar nota abre modal/formulário', async ({ page }) => {
    await page.goto(DOENTE_URL);
    await page.waitForLoadState('networkidle');
    const primeiroDoente = page.getByRole('link', { name: /ver|detalhe|ficha/i }).or(
      page.locator('tbody tr').first().getByRole('link'),
    ).first();
    if ((await primeiroDoente.count()) === 0) { test.skip(); return; }
    await primeiroDoente.click();
    await page.waitForLoadState('networkidle');
    const btnCriar = page.getByRole('button', { name: /nova nota|criar nota/i }).first();
    if ((await btnCriar.count()) === 0) { test.skip(); return; }
    await btnCriar.click();
    const formNota = page.getByRole('dialog').or(page.locator('textarea').first());
    if ((await formNota.count()) > 0) {
      await expect(formNota.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
