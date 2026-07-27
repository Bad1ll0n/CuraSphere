import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

// Painéis clínicos só renderizam para um role clínico (médico) com acesso ao doente e com dados.
// `prepararDoenteClinico` garante ambos usando a sessão UI atual (sem logins extra → sem colisão
// de anti-replay do TOTP). Um único login por ficheiro pela mesma razão.
test.describe('Sinais Vitais e Scores de Risco', () => {
  test('painel de sinais vitais, NEWS2 e scores de risco renderizam (médico)', async ({ page }) => {
    await loginAs(page, '00002');
    const doenteId = await prepararDoenteClinico(page);

    await page.goto(`/doentes/${doenteId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.getByText(/sinais vitais/i).first(), 'painel de sinais vitais').toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/news2/i).first(), 'badge/secção NEWS2').toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(/qSOFA|CURB-65|Scores de Risco|Escalas de Risco/i).first(),
      'secção de scores/escalas de risco',
    ).toBeVisible({ timeout: 8000 });
  });
});
