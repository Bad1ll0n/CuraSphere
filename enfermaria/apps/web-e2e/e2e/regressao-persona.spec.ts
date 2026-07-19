/**
 * Suíte de regressão de persona — invariantes sistémicos descobertos nas 7 vagas de
 * teste por persona (37 bugs reais). Bloqueiam a reintrodução das classes de bug mais
 * perigosas. Corre a nível de API (Playwright `request`, sem browser) contra a API em
 * http://localhost:3333 — entra no gate e2e do CI.
 *
 * Cobre os sistémicos do plano: guard drift (papel base vs sub-papel), req.user.sub,
 * break-glass (errorCode), prefixos /v1, ordem de rotas, login MFA-pendente.
 *
 * NOTA: o endpoint de login tem rate-limit de 5/10min por IP. A suíte faz login UMA vez
 * por role (4 no total) em beforeAll e reutiliza os contextos, para caber na janela.
 * Requer a seed de teste (apps/api/src/prisma/seed-test-users.ts): utilizadores 00001–00017,
 * password Teste1234!, segredo TOTP fixo nas roles clínicas, e ≥1 doente na seed.
 */
import { test, expect, request as pwRequest, APIRequestContext, APIResponse } from '@playwright/test';
import { createHmac } from 'crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3333';
const PASS = process.env['TEST_PASSWORD'] ?? 'Teste1234!';
const TOTP_SECRET = process.env['TEST_TOTP_SECRET'] ?? 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';

// ── TOTP inline (RFC 6238, SHA1/30s/6 dígitos) — evita dependência de otplib no e2e ──
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return (code % 1_000_000).toString().padStart(6, '0');
}
async function cookie(ctx: APIRequestContext, name: string): Promise<string | undefined> {
  return (await ctx.storageState()).cookies.find((c) => c.name === name)?.value;
}

interface Session { ctx: APIRequestContext; loginBody: any; }
async function login(numeroFuncionario: string, clinico: boolean): Promise<Session> {
  const ctx = await pwRequest.newContext({ baseURL: API });
  const res = await ctx.post('/v1/auth/login', { data: { numeroFuncionario, password: PASS } });
  expect(res.ok(), `login ${numeroFuncionario} status ${res.status()} (rate-limit 5/10min? reinicie a API)`).toBeTruthy();
  const loginBody = await res.json();
  if (clinico) {
    expect(loginBody.mfaPendente, `role clínica ${numeroFuncionario} deve exigir MFA`).toBeTruthy();
    const csrf = await cookie(ctx, 'csrf-token');
    const v = await ctx.post('/v1/auth/mfa/verificar', {
      data: { mfaChallengeToken: loginBody.mfaChallengeToken, code: totp(TOTP_SECRET) },
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    expect(v.ok(), `mfa/verificar ${numeroFuncionario} status ${v.status()}`).toBeTruthy();
  }
  return { ctx, loginBody };
}

let direcao: Session, medico: Session, enfermeiro: Session, chefe: Session;

test.describe.configure({ mode: 'serial' });
test.describe('Regressão de persona — invariantes sistémicos', () => {
  test.beforeAll(async () => {
    // 4 logins (dentro do limite de 5/10min). Reutilizados por todos os testes.
    direcao = await login('00001', false);      // oversight, sem MFA
    medico = await login('00002', true);         // clínico, com MFA
    enfermeiro = await login('00003', true);     // clínico simples
    chefe = await login('00015', true);          // sub-papel chefe_enfermeiros
  });
  test.afterAll(async () => {
    await Promise.all([direcao?.ctx.dispose(), medico?.ctx.dispose(), enfermeiro?.ctx.dispose(), chefe?.ctx.dispose()]);
  });

  test('prefixo /v1 é obrigatório: /v1/health=200, /health=404', async () => {
    const anon = await pwRequest.newContext({ baseURL: API });
    expect((await anon.get('/v1/health')).status()).toBe(200);
    expect((await anon.get('/health')).status()).toBe(404); // sem prefixo → rota não existe
    await anon.dispose();
  });

  test('login direção (00001) não exige MFA e devolve o utilizador', async () => {
    expect(direcao.loginBody.mfaPendente).toBeFalsy();
    expect(direcao.loginBody.utilizador?.numeroFuncionario).toBe('00001');
  });

  test('login role clínica (00002) exige MFA estruturado; req.user.sub resolve o próprio user', async () => {
    expect(medico.loginBody.mfaPendente).toBeTruthy();
    const me = await medico.ctx.get('/v1/auth/me'); // usa req.user.sub
    expect(me.status()).toBe(200);
    expect((await me.json()).numeroFuncionario).toBe('00002');
  });

  // ── Guard: papel base vs sub-papel (Vaga 1.2) + ordem de rotas (/doentes/export antes de :id) ──
  test('guard honra sub-papel: chefe_enfermeiros (00015) acede a endpoint chefe-only', async () => {
    const r = await chefe.ctx.get('/v1/doentes/export'); // @Roles(direcao, chefe_enfermeiros, qualidade)
    expect(r.status(), 'chefe_enfermeiros NÃO deve levar 403').not.toBe(403);
    expect(r.status()).toBeLessThan(500);
  });

  test('guard continua a negar: enfermeiro simples (00003) → 403 no mesmo endpoint chefe-only', async () => {
    const r = await enfermeiro.ctx.get('/v1/doentes/export');
    expect(r.status()).toBe(403);
  });

  // ── Break-glass: forma do erro estável (errorCode consumido pelo frontend) ─────
  test('acesso a doente não-atribuído → 403 com errorCode BREAK_GLASS_REQUIRED', async () => {
    const lista = await direcao.ctx.get('/v1/doentes?limit=1'); // oversight vê todos
    const doente = (await lista.json()).data?.[0];
    test.skip(!doente, 'sem doentes na seed — nada para testar');
    const r: APIResponse = await enfermeiro.ctx.get(`/v1/doentes/${doente.id}`);
    expect(r.status()).toBe(403);
    expect((await r.json()).errorCode).toBe('BREAK_GLASS_REQUIRED');
  });
});
