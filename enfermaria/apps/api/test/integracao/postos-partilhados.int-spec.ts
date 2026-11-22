import { createHash, randomUUID } from 'crypto';
import { arrancar, parar, entrar, criarDoenteInternado, Sessao, Contexto, PASSWORD } from './app-teste';

/**
 * UX-21 — desbloqueio do ecrã de um posto partilhado (a mesma sessão, a password conta falhas).
 * UX-28 — recuperação da password do portal (resposta igual com ou sem conta; token só em hash,
 * uso único).
 */
describe('integração: postos partilhados e recuperação do portal', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('UX-21: desbloquear confirma a password da sessão em curso, sem sessão nova', async () => {
    const s = await new Sessao(ctx.url).entrar('00008');
    const errada = await s.pedido('POST', '/auth/desbloquear', { password: 'nao-e-esta-password' });
    expect(errada.status).toBe(401);
    const { rows } = await ctx.bd.query(`SELECT "tentativasLoginFalhadas" AS n FROM utilizadores WHERE "numeroFuncionario" = '00008'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
    const certa = await s.pedido('POST', '/auth/desbloquear', { password: PASSWORD });
    expect(certa.status).toBe(201);
    expect(certa.json).toEqual({ desbloqueado: true });
    expect(certa.cabecalhos.getSetCookie?.() ?? []).toEqual([]); // não emite tokens novos
    const depois = await ctx.bd.query(`SELECT "tentativasLoginFalhadas" AS n FROM utilizadores WHERE "numeroFuncionario" = '00008'`);
    expect(depois.rows[0].n).toBe(0);
    expect((await new Sessao(ctx.url).pedido('POST', '/auth/desbloquear', { password: PASSWORD })).status).toBe(401); // sem sessão
  });

  it('UX-28: pedir recuperação dá a mesma resposta com ou sem conta; o link redefine uma vez', async () => {
    const email = `portal-rec-${randomUUID().slice(0, 6)}@teste.local`;
    const { doenteId } = await criarDoenteInternado(ctx, ['00003']);
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('POST', `/consentimentos-tratamento/doente/${doenteId}`, { finalidade: 'portal_doente', decisao: 'consentimento' })).status).toBe(201);
    expect((await enf.pedido('POST', '/portal/criar-acesso', { doenteId, email, senha: 'PortalRecupera123!' })).status).toBe(201);

    const anonimo = new Sessao(ctx.url);
    const comConta = await anonimo.pedido('POST', '/portal/recuperar', { email });
    const semConta = await anonimo.pedido('POST', '/portal/recuperar', { email: `ninguem-${randomUUID().slice(0, 6)}@teste.local` });
    expect(comConta.status).toBe(201);
    expect(semConta.json).toEqual(comConta.json);
    const { rows } = await ctx.bd.query(
      `SELECT r."tokenHash" FROM recuperacoes_portal r JOIN portal_doentes p ON p.id = r."portalId" WHERE p.email = $1`, [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // O token real só existe no email; o teste cria um seu, com o mesmo formato guardado.
    const token = `tok-${randomUUID()}`;
    await ctx.bd.query(
      `INSERT INTO recuperacoes_portal (id, "portalId", "tokenHash", "expiraEm") SELECT $1, id, $2, now() + interval '30 minutes' FROM portal_doentes WHERE email = $3`,
      [randomUUID(), createHash('sha256').update(token).digest('hex'), email],
    );
    expect((await anonimo.pedido('POST', '/portal/redefinir', { token, senha: 'nova frase longa de teste' })).status).toBe(201);
    expect((await anonimo.pedido('POST', '/portal/redefinir', { token, senha: 'outra frase longa de teste' })).status).toBe(400);
    expect((await new Sessao(ctx.url).pedido('POST', '/portal/login', { email, senha: 'nova frase longa de teste' })).status).toBeLessThan(300);
    expect((await new Sessao(ctx.url).pedido('POST', '/portal/login', { email, senha: 'PortalRecupera123!' })).status).toBe(401);
  });
});
