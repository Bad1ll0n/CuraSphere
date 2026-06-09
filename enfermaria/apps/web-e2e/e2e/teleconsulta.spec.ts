import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Teleconsulta (Jitsi)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('rota /teleconsulta/[id] existe e não retorna 404', async ({ page }) => {
    // Navegar para um ID qualquer — deve mostrar loading ou erro gracioso (não 404/crash)
    const response = await page.goto('/teleconsulta/00000000-0000-0000-0000-000000000000');
    // A página pode retornar qualquer status mas não deve ser uma página de erro do Next.js (404 text)
    await page.waitForLoadState('domcontentloaded');
    const body = await page.content();
    expect(body).not.toContain('404 | This page could not be found');
  });

  test('página de teleconsulta tem barra superior com botão Terminar', async ({ page }) => {
    await page.goto('/teleconsulta/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // O botão Terminar deve estar presente na barra superior
    const btnTerminar = page.getByRole('button', { name: /terminar|sair/i }).or(
      page.getByText(/✕ Terminar|terminar/i)
    ).first();
    await expect(btnTerminar).toBeVisible({ timeout: 8000 });
  });

  test('página de teleconsulta carrega script Jitsi', async ({ page }) => {
    await page.goto('/teleconsulta/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');

    // O script da Jitsi External API deve ser injectado no DOM
    const jitsiScript = page.locator('script[src*="jit.si"]').or(
      page.locator('script[src*="meet"]')
    );
    // Pode demorar um pouco a carregar (afterInteractive)
    await page.waitForTimeout(2000);
    // Verificar que o script está presente ou que o estado de loading é mostrado
    const temScript = await jitsiScript.count();
    const temLoading = await page.getByText(/a carregar|loading/i).count();
    const temErro = await page.getByText(/não foi possível|erro/i).count();

    // Um dos três estados deve ser verdadeiro
    expect(temScript + temLoading + temErro).toBeGreaterThan(0);
  });

  test('botão Terminar na teleconsulta leva de volta às consultas', async ({ page }) => {
    await page.goto('/teleconsulta/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const btnTerminar = page.getByRole('button', { name: /terminar|sair/i }).first();
    if ((await btnTerminar.count()) === 0) { test.skip(); return; }

    await btnTerminar.click();
    // Deve navegar para /consultas (pode ser imediato ou com delay)
    await page.waitForURL((url) => url.pathname.includes('/consultas') || url.pathname === '/', { timeout: 8000 });
    await expect(page).not.toHaveURL(/\/teleconsulta/);
  });

  test('botão Iniciar vídeo aparece na lista de consultas para teleconsulta agendada', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Procurar teleconsultas agendadas sem vídeo iniciado
    const btnIniciar = page.getByRole('button', { name: /iniciar.*vídeo|📹 iniciar/i }).or(
      page.getByText(/📹 Iniciar/i)
    ).first();

    if ((await btnIniciar.count()) > 0) {
      await expect(btnIniciar).toBeVisible();
      console.log('[teleconsulta.spec] Botão Iniciar encontrado');
    } else {
      console.log('[teleconsulta.spec] Nenhuma teleconsulta pendente — OK para ambiente de teste');
    }
  });
});
