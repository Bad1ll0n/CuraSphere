import { arrancar, parar, entrar, idDe, criarDoenteInternado, Contexto } from './app-teste';

/**
 * ARQ-08 — com `@Request() req: any`, `req.user.userId` (campo que não existe) passava no
 * typecheck: o registo de resultados de análises e de outcomes gravava o autor como `undefined`
 * e, sendo a coluna obrigatória, rebentava com 500. Agora o pedido é tipado.
 */
describe('integração: autor dos registos vem do utilizador autenticado', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('resultado de análise: 201 e registadoPorId = quem registou', async () => {
    const enfId = await idDe(ctx, '00003');
    const { doenteId } = await criarDoenteInternado(ctx, ['00003']);
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('POST', '/exames-lab', { doenteId, parametro: 'Hemoglobina', valor: 13.2, unidade: 'g/dL', refMin: 12, refMax: 16 });
    expect(r.status).toBe(201);
    const { rows } = await ctx.bd.query(`SELECT "registadoPorId" FROM resultados_analise WHERE id = $1`, [r.json.id]);
    expect(rows[0]?.registadoPorId).toBe(enfId);
  });

  it('outcome clínico: 201 e registadoPorId = quem registou', async () => {
    const dirId = await idDe(ctx, '00001'); // direção — pode registar outcomes
    const { doenteId } = await criarDoenteInternado(ctx);
    const dir = await entrar(ctx, '00001');
    const r = await dir.pedido('POST', '/outcomes', { doenteId, tipo: 'melhoria', dataOcorrido: new Date().toISOString() });
    expect(r.status).toBe(201);
    expect(r.json.registadoPor?.id).toBe(dirId);
  });
});
