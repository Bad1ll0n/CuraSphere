import { test, expect, request as pwRequest } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

/**
 * SEC-20 — pedido de acesso aos dados feito ao balcão: a qualidade (DPO) escolhe o titular em
 * Conformidade & RGPD e descarrega a exportação completa.
 */
test('DPO exporta os dados de um titular (art.º 15.º)', async ({ page }) => {
  const adm = await pwRequest.newContext({ baseURL: API });
  await adm.get('/v1/csrf-token');
  await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
  await adm.get('/v1/csrf-token');
  const h = { 'x-csrf-token': (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
  const marca = Date.now().toString(36);
  const nome = `Teodora Rgpd ${marca}`;
  const r = await adm.post('/v1/doentes/admitir', { data: { nome, dataNascimento: '1949-02-02', diagnosticoPrincipal: 'Observação' }, headers: h });
  expect(r.status()).toBe(201);
  const doenteId = (await r.json()).id;
  const cama = await adm.post('/v1/camas', { data: { numero: `RG-${marca}`, quarto: `RG${marca}`, servico: 'Medicina' }, headers: h });
  await adm.post(`/v1/doentes/${doenteId}/atribuir-cama`, { data: { camaId: (await cama.json()).id }, headers: h });
  await adm.dispose();

  await loginAs(page, '00010');
  await page.goto('/conformidade');
  await expect(page.getByRole('heading', { name: 'Direitos do titular e retenção' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('combobox').fill(`Teodora Rgpd ${marca}`);
  await page.getByRole('option', { name: new RegExp(nome) }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar dados (JSON)' }).click();
  const ficheiro = await (await download).path();
  const json = JSON.parse(readFileSync(ficheiro!, 'utf8'));
  expect(json.titular).toMatchObject({ id: doenteId, nome });
  expect(json.regulamento).toMatch(/art\.º 15\.º/);
  expect(JSON.stringify(json)).not.toContain('enc:');
});
