import { test, expect } from '@playwright/test';

/**
 * UX-07 — o seletor de idioma cumpre o que promete no que já está traduzido. O quiosque é
 * usado por utentes (muitos estrangeiros) e não exige sessão; em inglês, o ecrã inicial e
 * os serviços aparecem em inglês, e o seletor diz que o inglês é "beta".
 */
test.describe('i18n — quiosque em inglês', () => {
  test('com locale=en o quiosque mostra os serviços em inglês e o seletor marca EN como beta', async ({ page, context, baseURL }) => {
    const url = new URL(baseURL ?? 'http://localhost:3000');
    await context.addCookies([{ name: 'locale', value: 'en', domain: url.hostname, path: '/' }]);
    await page.goto('/quiosque');
    await expect(page.getByRole('heading', { name: 'Choose the service you need' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Pharmacy/ })).toBeVisible();
    await expect(page.getByText('Seleccione o serviço pretendido')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /EN/ })).toHaveAttribute('title', /beta/i);
  });

  test('em português (por omissão) o quiosque continua em português', async ({ page }) => {
    await page.goto('/quiosque');
    await expect(page.getByRole('heading', { name: 'Seleccione o serviço pretendido' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Farmácia/ })).toBeVisible();
  });
});
