import { generate } from 'otplib';
import { arrancar, parar, Contexto, PASSWORD, SEGREDO_TOTP, reservarJanela } from './app-teste';

/**
 * SEC-23 — a app mobile (`X-Cliente: mobile`) recebe os tokens no corpo, usa Bearer, renova com o
 * refresh token no corpo e completa o MFA. Antes o login no mobile falhava sempre: a API só punha
 * o token em cookie e o mobile gravava `undefined`.
 */
describe('integração: sessão do cliente nativo (mobile)', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  const post = (caminho: string, corpo: unknown, extra: Record<string, string> = {}) =>
    fetch(ctx.url + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cliente': 'mobile', ...extra }, body: JSON.stringify(corpo) });

  it('login → Bearer → refresh pelo corpo (roda o token) → logout', async () => {
    const r = await post('/auth/login', { numeroFuncionario: '00008', password: PASSWORD });
    expect(r.status).toBe(201);
    expect(r.headers.getSetCookie?.() ?? []).toEqual([]);
    const sessao: any = await r.json();
    expect(sessao.accessToken).toBeTruthy();
    expect(sessao.refreshToken).toBeTruthy();

    const me = await fetch(ctx.url + '/auth/me', { headers: { Authorization: `Bearer ${sessao.accessToken}` } });
    expect(me.status).toBe(200);

    // Um POST com Bearer e sem cookies passa o CSRF (não há sessão por cookie a forjar).
    const desbloquear = await post('/auth/desbloquear', { password: PASSWORD }, { Authorization: `Bearer ${sessao.accessToken}` });
    expect(desbloquear.status).toBe(201);

    const novo: any = await (await post('/auth/refresh', { refreshToken: sessao.refreshToken })).json();
    expect(novo.refreshToken).toBeTruthy();
    expect(novo.refreshToken).not.toBe(sessao.refreshToken);
    // O token antigo já não serve (rotação; reapresentá-lo revoga tudo).
    expect((await post('/auth/refresh', { refreshToken: novo.refreshToken })).status).toBe(201);
  });

  it('o refresh nativo ignora o cookie do browser', async () => {
    // Com um cookie de sessão, o CSRF recusa primeiro (403); sem ele, o refresh exige o token do
    // corpo (401). Em nenhum caso saem tokens.
    const comCookie = await post('/auth/refresh', {}, { Cookie: 'refresh_token=qualquer' });
    expect([401, 403]).toContain(comCookie.status);
    expect(JSON.stringify(await comCookie.json())).not.toMatch(/accessToken|refreshToken/);
    expect((await post('/auth/refresh', {})).status).toBe(401);
  });

  it('MFA no mobile: desafio e depois tokens no corpo', async () => {
    const r: any = await (await post('/auth/login', { numeroFuncionario: '00003', password: PASSWORD })).json();
    expect(r.mfaPendente).toBe(true);
    await reservarJanela('00003');
    const v = await post('/auth/mfa/verificar', { mfaChallengeToken: r.mfaChallengeToken, code: await generate({ secret: SEGREDO_TOTP }) });
    expect(v.status).toBe(201);
    const sessao: any = await v.json();
    expect(sessao.accessToken).toBeTruthy();
    expect(v.headers.getSetCookie?.() ?? []).toEqual([]);
  });
});
