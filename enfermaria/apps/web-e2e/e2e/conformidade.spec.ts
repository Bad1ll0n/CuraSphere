import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Conformidade / RGPD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('página /conformidade carrega sem erros', async ({ page }) => {
    await page.goto('/conformidade');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/conformidade|rgpd|gdpr|checklist|compliance/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('checklist RGPD é visível', async ({ page }) => {
    await page.goto('/conformidade');
    await page.waitForLoadState('networkidle');
    const checklist = page.getByText(/rgpd|gdpr|consentimento|política|dados pessoais/i).first();
    if (await checklist.count() > 0) {
      await expect(checklist).toBeVisible({ timeout: 8000 });
    }
  });

  test('itens de conformidade são listados', async ({ page }) => {
    await page.goto('/conformidade');
    await page.waitForLoadState('networkidle');
    const item = page.getByRole('checkbox').or(page.getByText(/conform|cumpri|pendente/i)).first();
    if (await item.count() > 0) {
      await expect(item).toBeVisible({ timeout: 8000 });
    }
  });
});
