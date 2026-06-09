import { test, expect } from '@playwright/test';

test.describe('Quiosque de Corredor', () => {
  // O quiosque é uma rota pública — não precisa de autenticação

  test('rota /quiosque carrega sem autenticação', async ({ page }) => {
    const response = await page.goto('/quiosque');
    await page.waitForLoadState('domcontentloaded');

    // Não deve redirecionar para /login
    await expect(page).not.toHaveURL(/\/login/);
    // E não deve retornar 404
    if (response) {
      expect(response.status()).not.toBe(404);
    }
  });

  test('página quiosque mostra lista de serviços disponíveis', async ({ page }) => {
    await page.goto('/quiosque');
    await page.waitForLoadState('networkidle');

    // Serviços: Admissão, Consulta, Faturação, Farmácia, Exames, Informações
    await expect(
      page.getByText(/admissão|admissao/i).or(page.getByText(/consulta/i)).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('quiosque não exibe navbar do dashboard', async ({ page }) => {
    await page.goto('/quiosque');
    await page.waitForLoadState('networkidle');

    // A sidebar/navbar do dashboard não deve estar visível no quiosque
    const sidebarDashboard = page.locator('[data-testid="sidebar"]').or(
      page.locator('nav a[href="/dashboard"]')
    ).first();

    const temSidebar = await sidebarDashboard.count();
    expect(temSidebar).toBe(0);
  });

  test('clicar num serviço do quiosque abre as opções', async ({ page }) => {
    await page.goto('/quiosque');
    await page.waitForLoadState('networkidle');

    // Clicar no primeiro serviço (ex: Admissão)
    const primeiroServico = page.getByText(/admissão|admissao|consulta/i).first();
    if ((await primeiroServico.count()) === 0) { test.skip(); return; }

    await primeiroServico.click();
    await page.waitForTimeout(500);

    // Deve mostrar opções de serviço (senha, marcação, etc.)
    const opcoes = page.getByText(/senha|tirar|marcar|consultar|marcação/i).first();
    await expect(opcoes).toBeVisible({ timeout: 6000 });
  });

  test('quiosque funciona com separadores de especialidade', async ({ page }) => {
    // Rota /quiosque/[servicoId] também deve funcionar
    await page.goto('/quiosque/consulta');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);
    // Deve ter conteúdo de selecção de especialidade ou médico
    const temConteudo = await page.getByText(/especialidade|médico|serviço/i).count();
    expect(temConteudo).toBeGreaterThan(0);
  });
});
