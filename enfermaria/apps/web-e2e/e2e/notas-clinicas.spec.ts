import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

// QA-22/QA-23: entrava como direção (sem acesso a /doentes), procurava "o primeiro doente" na
// lista e, não o encontrando, fazia `test.skip()` — passava sem testar nada. Agora abre um doente
// real (break-glass do médico) e afirma o que o painel mostra.
test.describe('Notas Clínicas', () => {
  test.describe.configure({ mode: 'serial' });
  let doenteId: string;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, '00012'); // médico (cardiologista) — distinto dos outros specs
    doenteId ??= await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}#notas`); // UX-29: separador 'Notas'
    await page.waitForLoadState('networkidle');
  });

  test('a ficha do doente mostra o painel de notas SOAP', async ({ page }) => {
    await expect(page.getByText('Notas Clínicas SOAP')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/erro ao carregar doente/i)).not.toBeVisible();
  });

  test('o médico pode criar uma nota: o botão abre o formulário SOAP', async ({ page }) => {
    const criar = page.getByRole('button', { name: 'Adicionar nota clínica SOAP' });
    await expect(criar).toBeVisible({ timeout: 10000 });
    await criar.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('dialog').locator('textarea').first()).toBeVisible();
  });
});
