import { test, expect } from '@playwright/test';
import { loginAs, prepararDoenteClinico } from './helpers';

// QA-23: entrava como direção, procurava "o primeiro doente" e fazia `test.skip()` quando não
// havia (7 skips silenciosos — a suite ficava verde sem testar nada). Agora abre um doente real
// e faz o upload pela interface, de ponta a ponta.
test.describe('Documentos de Saúde', () => {
  test.describe.configure({ mode: 'serial' });
  let doenteId: string;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, '00002'); // médico: pode carregar documentos
    doenteId ??= await prepararDoenteClinico(page);
    await page.goto(`/doentes/${doenteId}#exames`); // UX-29: separador 'Exames e documentos'
    await page.waitForLoadState('networkidle');
  });

  test('o dossier de saúde aparece na ficha, sem erros de autorização', async ({ page }) => {
    await expect(page.getByText('Dossier de Saúde')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/401|não autorizado|unauthorized/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Carregar documento', exact: true })).toBeVisible();
  });

  test('carregar um PDF pela interface: aparece no dossier', async ({ page }) => {
    const titulo = `Relatório E2E ${Date.now()}`;
    await page.getByRole('button', { name: 'Carregar documento', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Carregar Documento' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: `${titulo}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'),
    });
    await page.getByRole('button', { name: 'Carregar Documento', exact: true }).click();
    await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 10000 });
  });
});
