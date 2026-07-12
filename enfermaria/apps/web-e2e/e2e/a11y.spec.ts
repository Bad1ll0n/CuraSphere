import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

test.describe('Acessibilidade WCAG 2.1 AA', () => {
  test('página de login não tem violações críticas', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const criticas = results.violations.filter(v => v.impact === 'critical');
    expect(criticas, criticas.map(v => `${v.id}: ${v.description}`).join('\n')).toHaveLength(0);
  });

  test('dashboard principal não tem violações críticas', async ({ page }) => {
    await loginAs(page);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const criticas = results.violations.filter(v => v.impact === 'critical');
    expect(criticas, criticas.map(v => `${v.id}: ${v.description}`).join('\n')).toHaveLength(0);
  });

  test('página de listagem de doentes não tem violações críticas', async ({ page }) => {
    await loginAs(page, 'medico');
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const criticas = results.violations.filter(v => v.impact === 'critical');
    expect(criticas, criticas.map(v => `${v.id}: ${v.description}`).join('\n')).toHaveLength(0);
  });
});
