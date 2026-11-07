import { arrancar, parar, entrar, Contexto } from './app-teste';

// QA-20 — a app real arranca contra a BD de integração, com migrações e auditoria.
describe('integração: arranque, prontidão e sessão', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('/health/ready: BD, migrações e trilho de auditoria (Redis ausente → degradado, não falha)', async () => {
    const r = await fetch(`${ctx.url}/health/ready`);
    const b: any = await r.json();
    expect(r.status).toBe(200);
    expect(b.info).toMatchObject({ database: { status: 'up' }, migrations: { status: 'up' }, audit: { status: 'up' } });
    expect(b.ultimaMigracao).toBeTruthy();
  });

  it('login com MFA real (persona médica) e pedido autenticado, com id de correlação devolvido', async () => {
    const med = await entrar(ctx, '00002');
    const r = await med.pedido('GET', '/auth/me', undefined, { 'X-Correlation-Id': 'int-teste-1' });
    expect(r.status).toBe(200);
    expect(r.json?.numeroFuncionario ?? r.json?.utilizador?.numeroFuncionario).toBe('00002');
    expect(r.cabecalhos.get('x-correlation-id')).toBe('int-teste-1');
  });
});
