import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

test.describe('Medicação e Prescrições', () => {
  test('painel de medicação e ação de prescrever renderizam (médico)', async ({ page }) => {
    await loginAs(page, '00011'); // médico (distinto de outros specs → evita colisão de TOTP)
    const doenteId = await prepararDoenteClinico(page);

    await page.goto(`/doentes/${doenteId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.getByText(/medicação/i).first(), 'painel de medicação').toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /prescrever|nova prescri/i }).first(),
      'ação de prescrever',
    ).toBeVisible({ timeout: 8000 });
  });
});
