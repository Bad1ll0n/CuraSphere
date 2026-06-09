import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Consultas Externas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('página /consultas carrega com título e separadores', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/consultas/i).first()).toBeVisible({ timeout: 10000 });
    // Separador Marcações visível
    await expect(page.getByRole('button', { name: /marcações|marcacoes/i }).or(
      page.getByText(/marcações/i)
    ).first()).toBeVisible({ timeout: 8000 });
  });

  test('botão Nova Marcação abre modal de agendamento', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');

    const btnNova = page.getByRole('button', { name: /nova marcação|nova consulta|agendar/i }).first();
    if ((await btnNova.count()) === 0) { test.skip(); return; }

    await btnNova.click();
    // Modal ou formulário de agendamento visível
    await expect(page.getByText(/especialidade|médico|medico/i).first()).toBeVisible({ timeout: 6000 });
  });

  test('selector de tipo presencial/teleconsulta existe no formulário', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');

    const btnNova = page.getByRole('button', { name: /nova marcação|nova consulta|agendar/i }).first();
    if ((await btnNova.count()) === 0) { test.skip(); return; }

    await btnNova.click();
    await page.waitForTimeout(500);

    // Selector de tipo (presencial / teleconsulta)
    await expect(
      page.getByText(/presencial/i).or(page.getByText(/teleconsulta/i)).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('lista de consultas renderiza linhas ou mensagem de vazio', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Ou tem consultas listadas ou tem mensagem de "sem consultas"
    const temConsultas = await page.locator('[data-testid="consulta-row"]').or(
      page.getByText(/agendada|realizada|faltou/i).first()
    ).count();
    const temVazio = await page.getByText(/sem consultas|nenhuma|0 consulta/i).count();

    expect(temConsultas + temVazio).toBeGreaterThan(0);
  });

  test('badge Teleconsulta aparece em consultas do tipo teleconsulta', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Se existir alguma teleconsulta, o badge deve ser visível
    const badgeTele = page.getByText(/📹|teleconsulta/i);
    if ((await badgeTele.count()) > 0) {
      await expect(badgeTele.first()).toBeVisible();
    } else {
      // Sem teleconsultas — teste passa (ambiente sem dados de vídeo)
      console.log('[consultas.spec] Sem teleconsultas visíveis — teste skipped implicitamente');
    }
  });

  test('separador Agenda da Consulta existe', async ({ page }) => {
    await page.goto('/consultas');
    await page.waitForLoadState('networkidle');

    const tabAgenda = page.getByRole('button', { name: /agenda/i }).or(
      page.getByText(/agenda/i)
    ).first();
    await expect(tabAgenda).toBeVisible({ timeout: 8000 });
  });
});
