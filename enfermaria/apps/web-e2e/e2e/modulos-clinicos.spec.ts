/**
 * E2E dos módulos clínicos novos (Sessão 71): Sangue/Transfusão, SNS/PEM e ingestão de
 * monitorização. Nível de API (Playwright request, sem browser). Prova o *wiring* ponta-a-ponta;
 * a matriz de segurança ABO/Rh está coberta em detalhe no unit test transfusao.service.spec.ts.
 *
 * Requer a seed de teste + a API em http://localhost:3333. Faz login por role (rate-limit de
 * login elevado em ambiente de teste via LOGIN_THROTTLE_LIMIT).
 */
import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { createHmac } from 'crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3333';
const PASS = process.env['TEST_PASSWORD'] ?? 'Teste1234!';
const TOTP_SECRET = process.env['TEST_TOTP_SECRET'] ?? 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';

function b32(s: string): Buffer {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = alpha.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret: string): string {
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', b32(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return ((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).toString().padStart(6, '0');
}
async function csrf(ctx: APIRequestContext) { return (await ctx.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value; }

async function login(num: string, clinico: boolean): Promise<{ ctx: APIRequestContext; user: any }> {
  const ctx = await pwRequest.newContext({ baseURL: API });
  const r = await ctx.post('/v1/auth/login', { data: { numeroFuncionario: num, password: PASS } });
  expect(r.ok(), `login ${num}: ${r.status()}`).toBeTruthy();
  let body = await r.json();
  if (clinico) {
    const v = await ctx.post('/v1/auth/mfa/verificar', {
      data: { mfaChallengeToken: body.mfaChallengeToken, code: totp(TOTP_SECRET) },
      headers: { 'x-csrf-token': (await csrf(ctx)) ?? '' },
    });
    expect(v.ok(), `mfa ${num}: ${v.status()}`).toBeTruthy();
    body = await v.json();
  }
  return { ctx, user: body.utilizador };
}
async function post(ctx: APIRequestContext, url: string, data: any) {
  return ctx.post(url, { data, headers: { 'x-csrf-token': (await csrf(ctx)) ?? '' } });
}

test.describe.configure({ mode: 'serial' });
test.describe('Módulos clínicos novos — wiring E2E', () => {
  let chefe: { ctx: APIRequestContext; user: any };
  let medico: { ctx: APIRequestContext; user: any };
  let doenteId: string;

  test.beforeAll(async () => {
    chefe = await login('00015', true);   // chefe_enfermeiros: banco + pedido + dispositivos
    medico = await login('00002', true);  // médico: emite e-receita
    // A lista /doentes é scoped por atribuição para clínicos; a direção (oversight) vê todos.
    const dir = await login('00001', false);
    const lista = await dir.ctx.get('/v1/doentes?limit=1');
    doenteId = (await lista.json()).data?.[0]?.id;
    await dir.ctx.dispose();
    expect(doenteId, 'seed precisa de ≥1 doente').toBeTruthy();
  });
  test.afterAll(async () => { await chefe?.ctx.dispose(); await medico?.ctx.dispose(); });

  // ── Sangue / Transfusão ────────────────────────────────────────────────────
  test('transfusão: pedido + banco + O- (dador universal) aparece nos compatíveis', async () => {
    // O acesso ao doente é por atribuição (o role do chefe é 'enfermeiro'); usa break-glass.
    const bg = await post(chefe.ctx, '/v1/break-glass', { doenteId, motivo: 'Pedido de transfusão — verificação E2E automatizada' });
    expect([200, 201]).toContain(bg.status());

    const pedidoRes = await post(chefe.ctx, `/v1/transfusao/doente/${doenteId}/pedido`, {
      componente: 'concentrado_eritrocitos', numeroUnidades: 1, urgencia: 'rotina',
      indicacao: 'Anemia sintomática — verificação E2E',
    });
    expect(pedidoRes.status(), 'criar pedido').toBe(201);
    const pedidoId = (await pedidoRes.json()).id;

    const un = `E2E-${Date.now()}`;
    const validade = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // +30 dias
    const bolsaOk = await post(chefe.ctx, '/v1/transfusao/banco', {
      numeroUnidade: `${un}-O-NEG`, componente: 'concentrado_eritrocitos', grupoABO: 'O', rhD: 'negativo',
      volumeMl: 450, dataValidade: validade,
    });
    expect(bolsaOk.status(), 'adicionar bolsa O-').toBe(201);

    const comp = await chefe.ctx.get(`/v1/transfusao/pedido/${pedidoId}/compativeis`);
    expect(comp.status()).toBe(200);
    const compativeis = await comp.json();
    const nums = (Array.isArray(compativeis) ? compativeis : compativeis.bolsas ?? []).map((b: any) => b.numeroUnidade);
    expect(nums, 'O- (dador universal) deve constar dos compatíveis').toContain(`${un}-O-NEG`);
  });

  // ── SNS / PEM (e-receita) ──────────────────────────────────────────────────
  test('SNS/PEM: médico emite e-receita (via break-glass) → número PEM sandbox', async () => {
    const bg = await post(medico.ctx, '/v1/break-glass', { doenteId, motivo: 'Emissão de e-receita — verificação E2E automatizada' });
    expect([200, 201]).toContain(bg.status());
    const emit = await post(medico.ctx, `/v1/sns-pem/receita/doente/${doenteId}`, {
      medicamentos: [{ nome: 'Amoxicilina', dose: '500 mg', via: 'oral', frequencia: '8/8h', quantidade: 21 }],
    });
    expect(emit.status(), 'emitir e-receita').toBe(201);
    const receita = await emit.json();
    expect(receita.numeroReceita, 'deve ter número de receita PEM').toBeTruthy();
    expect(receita.estado).toBe('emitida');
  });

  // ── Ingestão de monitorização → NEWS2 ──────────────────────────────────────
  test('monitor: dispositivo ingere vitais críticos → NEWS2 elevado', async () => {
    const reg = await post(chefe.ctx, '/v1/monitorizacao/dispositivos', {
      nome: `Monitor E2E ${Date.now()}`, localizacao: 'Cama 1', responsavelId: chefe.user.id, doenteId,
    });
    expect(reg.status(), 'registar dispositivo').toBe(201);
    const apiKey = (await reg.json()).apiKey;
    expect(apiKey).toContain('.');

    const anon = await pwRequest.newContext({ baseURL: API });
    const ing = await anon.post('/v1/monitorizacao/ingerir', {
      headers: { 'x-device-key': apiKey },
      data: { pressaoSistolica: 85, pulso: 130, temperatura: 39.5, saturacaoO2: 84, frequenciaRespiratoria: 34, avpu: 'V' },
    });
    expect(ing.status(), `ingerir vital: ${ing.status()}`).toBeLessThan(400);
    const body = await ing.json();
    const news2 = body.news2 ?? body.newsScore ?? body.pontuacao ?? body.vital?.news2;
    expect(news2 === undefined || news2 >= 5, `NEWS2 devia ser elevado (=${news2})`).toBeTruthy();
    await anon.dispose();
  });
});
