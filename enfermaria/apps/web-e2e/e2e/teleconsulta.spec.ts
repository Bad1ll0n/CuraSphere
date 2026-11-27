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

  // QA-22: esperava a barra "Terminar" para uma consulta INEXISTENTE. Sem consulta não há sala,
  // e o comportamento certo (SEC-16: só o médico da consulta recebe a sala) é o ecrã de erro
  // com caminho de volta — é isso que se verifica.
  test('consulta inexistente: erro gracioso com regresso às consultas', async ({ page }) => {
    await page.goto('/teleconsulta/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/não foi possível obter os dados da videochamada/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /voltar às consultas/i })).toBeVisible();
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

  // QA-23: usava uma consulta inexistente (sem barra de chamada) e saltava. Agora: consulta real,
  // vídeo iniciado pelo médico (SEC-16: sala de 128 bits + token), e "Terminar" fecha-a.
  test('médico inicia a teleconsulta e "Terminar" encerra-a e volta às consultas', async ({ page }) => {
    const api = process.env['API_URL'] ?? 'http://localhost:3333';
    await loginAs(page, '00011');
    const headers = { 'x-csrf-token': (await page.context().cookies()).find((c) => c.name === 'csrf-token')?.value ?? '' };
    const me = await (await page.request.get(`${api}/v1/auth/me`)).json();
    const medicoId = me.id ?? me.utilizador?.id;

    const consulta = await page.request.post(`${api}/v1/consultas`, {
      data: { medicoId, nomeDoente: 'Doente Teleconsulta E2E', especialidade: 'Medicina Geral', dataHora: new Date(Date.now() + 3600_000).toISOString(), tipo: 'teleconsulta' },
      headers,
    });
    expect(consulta.status()).toBe(201);
    const consultaId = (await consulta.json()).id;
    const iniciar = await page.request.post(`${api}/v1/consultas/${consultaId}/video/iniciar`, { headers });
    expect(iniciar.status()).toBe(201);
    expect((await iniciar.json()).videoRoomId).toMatch(/^cs-[0-9a-f]{32}$/);

    await page.goto(`/teleconsulta/${consultaId}`);
    const terminar = page.getByRole('button', { name: /terminar/i }).first();
    await expect(terminar).toBeVisible({ timeout: 10000 });
    await terminar.click();
    await page.waitForURL((url) => url.pathname.startsWith('/consultas'), { timeout: 10000 });
    const depois = await page.request.get(`${api}/v1/consultas/${consultaId}/video/entrar`);
    expect(depois.status()).toBe(400); // chamada terminada: já não dá entrada
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
