import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

/**
 * PROD-13 — continuidade de cuidados pelo ecrã: referenciar para a RNCCI, marcá-la como enviada
 * e registar um ensino com teach-back. A sinalização, a alta clínica e as altas proteladas estão
 * verificadas na integração.
 */
test.describe('Continuidade de cuidados (planeamento de alta)', () => {
  test('referenciação RNCCI e ensino ao doente', async ({ page }) => {
    await loginAs(page, '00014'); // enfermeiro
    const doenteId = await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}#alta`);
    const painel = page.getByRole('region', { name: 'Continuidade de cuidados' });
    await expect(painel).toBeVisible({ timeout: 15000 });

    const motivo = `Dependente nas AVD, precisa de reabilitação ${Date.now()}`;
    await painel.getByLabel('Destino').selectOption({ label: 'RNCCI — Unidade de Convalescença' });
    await painel.getByLabel('Motivo / necessidade').fill(motivo);
    await painel.getByRole('button', { name: 'Referenciar' }).click();
    const ref = painel.getByRole('listitem').filter({ hasText: motivo });
    await expect(ref).toContainText('Proposta', { timeout: 10000 });
    await ref.getByRole('button', { name: 'Marcar como enviada' }).click();
    await expect(ref).toContainText('Enviada', { timeout: 10000 });

    await painel.getByLabel('Tema').selectOption({ label: 'Prevenção de quedas' });
    await expect(painel.getByText('Levante em três tempos')).toBeVisible();
    await painel.getByLabel('Compreensão (teach-back)').selectOption({ label: 'Compreendeu' });
    await painel.getByRole('button', { name: 'Registar ensino' }).click();
    await expect(painel.getByRole('listitem').filter({ hasText: 'Prevenção de quedas' }).first()).toContainText('Compreendeu', { timeout: 10000 });
  });
});
