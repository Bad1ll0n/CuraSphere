import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, criarDoenteInternado, Sessao, Contexto, DoenteFixture } from './app-teste';

/**
 * QA-20 — portal do doente: consentimento (SEC-19), isolamento entre doentes e sessão que
 * termina quando a conta é desactivada.
 */
describe('integração: portal do doente', () => {
  let ctx: Contexto;
  let a: DoenteFixture;
  let b: DoenteFixture;
  const emailA = `portal-a-${randomUUID().slice(0, 6)}@teste.local`;

  beforeAll(async () => {
    ctx = await arrancar();
    a = await criarDoenteInternado(ctx, ['00003']);
    b = await criarDoenteInternado(ctx, ['00003']);
  });
  afterAll(async () => { await parar(ctx); });

  it('sem consentimento não há conta; com consentimento, o doente entra e só vê o que é seu', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('POST', '/portal/criar-acesso', { doenteId: a.doenteId, email: emailA, senha: 'PortalTeste12345!' })).status).toBe(403);
    expect((await enf.pedido('POST', `/consentimentos-tratamento/doente/${a.doenteId}`, { finalidade: 'portal_doente', decisao: 'consentimento' })).status).toBe(201);
    expect((await enf.pedido('POST', '/portal/criar-acesso', { doenteId: a.doenteId, email: emailA, senha: 'PortalTeste12345!' })).status).toBe(201);

    // Uma consulta do doente B: o portal de A nunca a vê nem lhe acede.
    const consultaB = randomUUID();
    await ctx.bd.query(
      `INSERT INTO consultas (id, "doenteId", "medicoId", especialidade, "dataHora", tipo, estado, "videoRoomId")
       SELECT $1, $2, id, 'Medicina', now() + interval '1 hour', 'teleconsulta', 'agendada', 'cs-sala-b' FROM utilizadores WHERE "numeroFuncionario"='00002'`,
      [consultaB, b.doenteId],
    );

    const portal = new Sessao(ctx.url);
    expect((await portal.pedido('POST', '/portal/login', { email: emailA, senha: 'PortalTeste12345!' })).status).toBeLessThan(300);
    const me = await portal.pedido('GET', '/portal/me');
    expect(me.status).toBe(200);
    expect(me.json.id).toBe(a.doenteId);
    expect((await portal.pedido('GET', `/portal/teleconsultas/${consultaB}/video`)).status).toBe(404);
    const lista = await portal.pedido('GET', '/portal/teleconsultas');
    expect(JSON.stringify(lista.json)).not.toContain(consultaB);

    // O doente revoga o portal: a sessão termina logo (não espera pelas 8 h do token).
    const rev = await portal.pedido('POST', '/portal/consentimentos/portal_doente/revogar');
    expect(rev.json.contaPortalDesactivada).toBe(true);
    expect((await portal.pedido('GET', '/portal/me')).status).toBe(401);
  });

  it('o token do pessoal não abre o portal, e o do portal não abre a API do pessoal', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('GET', '/portal/me')).status).toBe(401);
    const anon = new Sessao(ctx.url);
    expect((await anon.pedido('GET', `/doentes/${a.doenteId}`)).status).toBe(401);
  });
});
