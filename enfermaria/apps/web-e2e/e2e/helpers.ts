import { Page } from '@playwright/test';

type Role = 'admin' | 'medico' | 'enfermeiro';

const CREDS: Record<Role, { user: string; password: string }> = {
  admin:      { user: process.env['TEST_USER'] ?? '00001',      password: process.env['TEST_PASSWORD'] ?? 'Admin1234!' },
  medico:     { user: process.env['TEST_MEDICO'] ?? '00002',    password: process.env['TEST_MEDICO_PASSWORD'] ?? 'Medico1234!' },
  enfermeiro: { user: process.env['TEST_ENFERMEIRO'] ?? '00003', password: process.env['TEST_ENFERMEIRO_PASSWORD'] ?? 'Enfer1234!' },
};

export async function loginAs(page: Page, role: Role = 'admin') {
  const { user, password } = CREDS[role];
  await page.goto('/login');
  await page.getByPlaceholder('Ex: 00001').fill(user);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}
