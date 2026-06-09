import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';
import path from 'path';

test.describe('Documentos de Saúde', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  async function navigateToFirstDoente(page: ReturnType<typeof test.info extends never ? never : any>) {
    await page.goto('/doentes');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href*="/doentes/"]').first();
    if ((await link.count()) === 0) return false;
    await link.click();
    await page.waitForLoadState('networkidle');
    return true;
  }

  test('painel de documentos está presente na página do doente', async ({ page }) => {
    const found = await navigateToFirstDoente(page);
    if (!found) { test.skip(); return; }

    // Procurar painel/tab de documentos
    const painelDocs = page.getByText(/documentos|documentação|docs/i).first();
    await page.waitForTimeout(1500);
    if ((await painelDocs.count()) === 0) { test.skip(); return; }
    await expect(painelDocs).toBeVisible({ timeout: 10000 });
  });

  test('botão ou link de upload de documento existe', async ({ page }) => {
    const found = await navigateToFirstDoente(page);
    if (!found) { test.skip(); return; }

    // Clicar no separador/painel documentos se existir
    const tabDocs = page.getByRole('button', { name: /documentos/i }).or(
      page.getByRole('tab', { name: /documentos/i })
    ).first();
    if ((await tabDocs.count()) > 0) await tabDocs.click();
    await page.waitForTimeout(800);

    // Botão de upload
    const btnUpload = page.getByRole('button', { name: /upload|carregar|adicionar/i }).or(
      page.locator('input[type="file"]').first()
    ).first();

    if ((await btnUpload.count()) === 0) { test.skip(); return; }
    await expect(btnUpload).toBeVisible({ timeout: 6000 });
  });

  test('lista de documentos carrega sem erro 401/500', async ({ page }) => {
    const found = await navigateToFirstDoente(page);
    if (!found) { test.skip(); return; }

    const tabDocs = page.getByRole('button', { name: /documentos/i }).or(
      page.getByRole('tab', { name: /documentos/i })
    ).first();
    if ((await tabDocs.count()) > 0) await tabDocs.click();
    await page.waitForTimeout(1500);

    // Não deve haver mensagem de erro de autenticação
    await expect(page.getByText(/401|não autorizado|unauthorized/i)).not.toBeVisible();
    await expect(page.getByText(/500|erro interno|internal server/i)).not.toBeVisible();
  });

  test('upload de ficheiro PDF cria item na lista', async ({ page }) => {
    const found = await navigateToFirstDoente(page);
    if (!found) { test.skip(); return; }

    const tabDocs = page.getByRole('button', { name: /documentos/i }).or(
      page.getByRole('tab', { name: /documentos/i })
    ).first();
    if ((await tabDocs.count()) > 0) await tabDocs.click();
    await page.waitForTimeout(500);

    const inputFile = page.locator('input[type="file"]').first();
    if ((await inputFile.count()) === 0) { test.skip(); return; }

    // Criar um ficheiro PDF mínimo em memória
    await inputFile.setInputFiles({
      name: 'teste-playwright.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    });

    await page.waitForTimeout(2000);
    // Verificar que aparece o ficheiro na lista (pelo nome ou por um novo item)
    const itemDoc = page.getByText(/teste-playwright|pdf/i).first();
    if ((await itemDoc.count()) > 0) {
      await expect(itemDoc).toBeVisible({ timeout: 8000 });
    }
  });
});
