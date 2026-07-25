import { Page } from '@playwright/test';
import { createHmac } from 'crypto';

type Role = 'admin' | 'medico' | 'enfermeiro';

const CREDS: Record<Role, { user: string; password: string }> = {
  admin:      { user: process.env['TEST_USER'] ?? '00001',      password: process.env['TEST_PASSWORD'] ?? 'Teste1234!' },
  medico:     { user: process.env['TEST_MEDICO'] ?? '00002',    password: process.env['TEST_MEDICO_PASSWORD'] ?? 'Teste1234!' },
  enfermeiro: { user: process.env['TEST_ENFERMEIRO'] ?? '00003', password: process.env['TEST_ENFERMEIRO_PASSWORD'] ?? 'Teste1234!' },
};

const TOTP_SECRET = process.env['TEST_TOTP_SECRET'] ?? 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';

// ── TOTP inline (RFC 6238, SHA1/30s/6 dígitos) — evita dependência de `otplib` no
// pacote web-e2e (pnpm estrito não o resolve aqui; ver apps/web-e2e/e2e/regressao-persona.spec.ts
// para a mesma implementação usada a nível de API). ──
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

/**
 * Faz login pela UI em `/login`.
 *
 * Aceita:
 *  - um `Role` conhecido (`'admin' | 'medico' | 'enfermeiro'`) — mantém compatibilidade
 *    com os specs existentes que chamam `loginAs(page)` / `loginAs(page, 'medico')`.
 *  - um número de funcionário em bruto (ex.: `'00011'`) para qualquer persona da seed —
 *    usado pelo smoke test por persona. Password por omissão: `Teste1234!`.
 *
 * Trata automaticamente o passo de MFA (roles clínicas 00002-00006, 00011-00017) gerando
 * o TOTP a partir do segredo fixo de teste.
 */
export async function loginAs(page: Page, roleOrNumero: Role | string = 'admin', password?: string): Promise<void> {
  const isKnownRole = Object.prototype.hasOwnProperty.call(CREDS, roleOrNumero);
  const user = isKnownRole ? CREDS[roleOrNumero as Role].user : roleOrNumero;
  const pass = isKnownRole ? CREDS[roleOrNumero as Role].password : (password ?? process.env['TEST_PASSWORD'] ?? 'Teste1234!');

  await page.goto('/login');
  // NOTA: o placeholder do campo de nº de funcionário passou de "Ex: 00001" para
  // "Ex: 12345" (ver apps/web/src/messages/pt.json:52, employeeNumberPlaceholder) —
  // isto quebrou silenciosamente o login em toda a suite antiga (helpers.ts + auth.spec.ts
  // hardcoded ambos o texto antigo). Ver relatório de QA para detalhe.
  await page.getByPlaceholder('Ex: 12345').fill(user);
  await page.getByPlaceholder('••••••••').fill(pass);
  await page.getByRole('button', { name: 'Entrar' }).click();

  const mfaInput = page.getByPlaceholder('000000');
  const redirected = page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 })
    .then(() => 'redirected' as const)
    .catch(() => null);
  const mfaVisible = mfaInput
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => 'mfa' as const)
    .catch(() => null);
  const outcome = await Promise.race([redirected, mfaVisible]);

  if (outcome === 'mfa') {
    await mfaInput.fill(totp(TOTP_SECRET));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
    await dismissFirstLoginTour(page);
    return;
  }
  if (outcome === 'redirected') {
    await dismissFirstLoginTour(page);
    return;
  }

  // Nem MFA nem redirect em 10s — diagnostica os caminhos alternativos conhecidos do
  // formulário de login (ver apps/web/src/app/(auth)/login/page.tsx) em vez de um timeout opaco.
  const url = page.url();
  if (url.includes('/login/mfa-setup')) {
    throw new Error(`loginAs(${user}): conta caiu no fluxo de setup MFA obrigatório (mfaSetupObrigatorio) em vez do fluxo de verificação — pode precisar de reseed da conta de teste.`);
  }
  if (url.includes('/login/alterar-password')) {
    throw new Error(`loginAs(${user}): password expirada — redirecionado para /login/alterar-password.`);
  }
  throw new Error(`loginAs(${user}): login não avançou (nem MFA nem redirect) em 10s — url atual: ${url}`);
}

/**
 * Fecha o "tour" de primeira utilização (apps/web/src/components/tour-overlay.tsx), que
 * apps/web/src/app/(dashboard)/client-layout.tsx mostra sempre que `localStorage` não tem a
 * chave `curasphere_tour_<userId>` — ou seja, SEMPRE, num browser context novo do Playwright.
 * É um <div class="fixed inset-0 ... z-[100]"> que intercepta pointer events em toda a página,
 * pelo que, sem isto, qualquer clique feito a seguir ao login (em qualquer spec) fica bloqueado
 * e expira ao fim de ~30s com "<div ...> intercepts pointer events" no log do Playwright.
 * Isto explicou a maioria das falhas da suite antiga (ver relatório de QA).
 */
async function dismissFirstLoginTour(page: Page): Promise<void> {
  const skipButton = page.getByRole('button', { name: /saltar tour|skip tour/i });
  try {
    await skipButton.click({ timeout: 3000 });
  } catch {
    // Tour não apareceu (ou já foi fechado) — nada a fazer.
  }
}
