import { test, expect, request as pwRequest } from '@playwright/test';
import { loginAs } from './helpers';

const API = process.env['API_URL'] ?? 'http://localhost:3333';

/**
 * UX-10 / ARQ-28 — um enfermeiro abre a ficha de um doente a que não está atribuído: em vez de
 * "Doente não encontrado" (o 403 era mostrado como 404) e de um `window.prompt`, vê o ecrã de
 * acesso, pede a atribuição à chefia e, depois, usa o acesso de emergência com motivo.
 */
test.describe('Ficha sem atribuição', () => {
  test('ecrã de acesso: pedir atribuição e acesso de emergência', async ({ page }) => {
    const adm = await pwRequest.newContext({ baseURL: API });
    await adm.get('/v1/csrf-token');
    await adm.post('/v1/auth/login', { data: { numeroFuncionario: '00007', password: 'Teste1234!' } });
    await adm.get('/v1/csrf-token');
    const h = { 'x-csrf-token': (await adm.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
    const marca = Date.now().toString().slice(-6);
    const r = await adm.post('/v1/doentes/admitir', { data: { nome: `Doente Sem Acesso ${marca}`, dataNascimento: '1960-01-01', diagnosticoPrincipal: 'Celulite' }, headers: h });
    expect(r.status()).toBe(201);
    const doenteId = (await r.json()).id;
    await adm.dispose();

    let houvePrompt = false;
    page.on('dialog', async (d) => { houvePrompt = true; await d.dismiss(); });

    await loginAs(page, '00003'); // enfermeiro sem atribuição a este doente
    await page.goto(`/doentes/${doenteId}`);
    await expect(page.getByRole('heading', { name: 'Não está atribuído a este doente' })).toBeVisible({ timeout: 15000 });
    expect(houvePrompt).toBe(false);

    await page.getByRole('button', { name: 'Pedir atribuição' }).click();
    await expect(page.getByText(/Pedido enviado à chefia|Não há chefia ativa/)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Acesso de emergência' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Acesso de emergência (break-glass)' });
    await dialogo.getByLabel('Motivo').selectOption({ label: 'Chamado para ajudar' });
    await dialogo.getByLabel('Justificação').fill('Chamada pela colega do quarto ao lado para uma queda');
    await dialogo.getByRole('button', { name: 'Aceder agora' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Doente Sem Acesso ${marca}`) })).toBeVisible({ timeout: 15000 });

    // SEC-14: o acesso fica por rever; a qualidade revê-o (não pode ser quem o fez).
    await loginAs(page, '00010');
    await page.goto('/acessos-emergencia');
    const cartao = page.getByRole('listitem').filter({ hasText: `Doente Sem Acesso ${marca}` });
    await expect(cartao).toBeVisible({ timeout: 15000 });
    await expect(cartao).toContainText('Chamada pela colega do quarto ao lado');
    await cartao.getByRole('button', { name: 'Justificado', exact: true }).click();
    await expect(page.getByText('Revisão registada')).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: `Doente Sem Acesso ${marca}` })).toContainText(/Justificado — revisto por/);
  });

  test('justificação curta é recusada pela API (SEC-14)', async () => {
    const dir = await pwRequest.newContext({ baseURL: API });
    await dir.get('/v1/csrf-token');
    await dir.post('/v1/auth/login', { data: { numeroFuncionario: '00001', password: 'Teste1234!' } });
    await dir.get('/v1/csrf-token');
    const h = { 'x-csrf-token': (await dir.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value ?? '' };
    const lista = await (await dir.get('/v1/doentes?todos=true&limit=1')).json();
    const r = await dir.post('/v1/break-glass', { data: { doenteId: lista.data[0].id, motivo: 'x' }, headers: h });
    expect(r.status()).toBe(400);
    await dir.dispose();
  });
});
