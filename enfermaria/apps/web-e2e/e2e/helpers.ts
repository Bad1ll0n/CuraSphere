import { Page } from '@playwright/test';

export async function loginAs(page: Page, user = '00001', password = 'Admin1234!') {
  await page.goto('/login');
  await page.getByPlaceholder('Ex: 00001').fill(process.env['TEST_USER'] ?? user);
  await page.getByPlaceholder('••••••••').fill(process.env['TEST_PASSWORD'] ?? password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}
