import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// A worklist de imagiologia é acedida por médicos/enfermeiros/técnicos. Um único login por
// ficheiro, com um médico distinto dos outros specs (evita colisão de anti-replay do TOTP).
test.describe('Worklist', () => {
  test('worklist de imagiologia carrega e renderiza para o médico', async ({ page }) => {
    await loginAs(page, '00013'); // médico (neurologista)
    await page.goto('/worklist');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible();
    await expect(page.getByText(/worklist|imagiolog|exame|pendente/i).first()).toBeVisible({ timeout: 10000 });
  });
});
