import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

/**
 * PROD-07 — o processo de enfermagem pelo ecrã: avaliação inicial, aplicar um conjunto tipo,
 * registar a execução de uma intervenção e reavaliar o diagnóstico como resolvido.
 * A verificação fina (sugestões pelas escalas, acesso, "O meu turno") está na integração.
 */
test.describe('Plano de cuidados de enfermagem', () => {
  test('avaliação inicial, conjunto tipo, execução e reavaliação', async ({ page }) => {
    await loginAs(page, '00014'); // enfermeiro
    const doenteId = await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}#cuidados`);
    const painel = page.getByRole('region', { name: 'Plano de cuidados de enfermagem' });
    await expect(painel).toBeVisible({ timeout: 15000 });

    // Avaliação inicial (fazer ou rever, conforme o doente já a tenha).
    await painel.getByRole('button', { name: /avaliação inicial/i }).click();
    await painel.getByLabel('Mobilidade e risco de queda').fill('Levante com ajuda de uma pessoa');
    await painel.getByLabel('Avaliação completa').check();
    await painel.getByRole('button', { name: 'Guardar' }).click();
    await expect(painel.getByText(/Avaliação inicial completa/)).toBeVisible({ timeout: 10000 });

    // Conjunto tipo "Risco de queda".
    const conjunto = painel.getByLabel('Conjunto tipo');
    await conjunto.selectOption({ label: 'Risco de queda — Morse ≥ 25' });
    await painel.getByRole('button', { name: 'Aplicar conjunto' }).click();
    // O item do diagnóstico (não o de uma sugestão) é o que tem o seletor de reavaliação.
    const diag = painel.getByRole('listitem').filter({ hasText: 'Queda · risco', has: page.getByRole('combobox', { name: 'Reavaliar' }) });
    await expect(diag).toBeVisible({ timeout: 10000 });

    // Registar a primeira intervenção.
    const intervencao = diag.getByRole('listitem').filter({ hasText: 'Vigiar o risco de queda e o ambiente' });
    await intervencao.getByRole('button', { name: 'Registar' }).click();
    await expect(intervencao.getByText(/Último registo:/)).toBeVisible({ timeout: 10000 });

    // Reavaliar como resolvido: sai dos diagnósticos ativos.
    await diag.getByLabel('Reavaliar').selectOption('resolvido');
    await page.getByRole('dialog').getByRole('textbox').fill('Sem quedas, marcha autónoma');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(diag).toHaveCount(0, { timeout: 10000 });
  });
});
