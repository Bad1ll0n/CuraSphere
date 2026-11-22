import { arrancar, parar, entrar, criarDoenteInternado, Contexto } from './app-teste';

/**
 * QA-17 — mensagens de validação em PT-PT; PROD-24 — o campo do plano de alta já não tem letras
 * cirílicas; UX-20 — no executivo, "camas ocupadas" e "internados" usam a mesma definição.
 */
describe('integração: validação em PT, plano de alta e KPIs do executivo', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('QA-17: um 400 de validação vem em português', async () => {
    const { doenteId } = await criarDoenteInternado(ctx, ['00003']);
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('POST', `/sinais-vitais/${doenteId}`, { pressaoSistolica: -5, saturacaoO2: 120, campoInventado: 1 });
    expect(r.status).toBe(400);
    const todas = JSON.stringify(r.json);
    expect(todas).not.toMatch(/\b(must|should not|property)\b/);
    expect(todas).toContain('O campo campoInventado não é permitido');
  });

  it('PROD-24: o plano de alta grava e devolve `afebril24h`', async () => {
    const { doenteId, camaId } = await criarDoenteInternado(ctx, ['00003']);
    // O fixture não abre episódio; o plano de alta é do episódio em curso (PROD-02).
    await ctx.bd.query(
      `INSERT INTO episodios_internamento (id, "doenteId", numero, origem, estado, "camaId") VALUES (gen_random_uuid()::text, $1, 1, 'admissao', 'ativo', $2)`,
      [doenteId, camaId],
    );
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('PATCH', `/plano-alta/${doenteId}`, { afebril24h: true });
    expect({ status: r.status, corpo: r.json }).toMatchObject({ status: 200 });
    const g = await enf.pedido('GET', `/plano-alta/${doenteId}`);
    expect(g.json.afebril24h).toBe(true);
  });

  it('UX-20: camas ocupadas = camas com um doente internado', async () => {
    await criarDoenteInternado(ctx);
    const dir = await entrar(ctx, '00001');
    const r = await dir.pedido('GET', '/dashboard/executivo');
    expect(r.status).toBe(200);
    const { rows } = await ctx.bd.query(
      `SELECT count(*)::int AS n FROM camas c JOIN doentes d ON d."camaId" = c.id WHERE d."estadoRegisto" = 'internado' AND d.ativo`,
    );
    expect(r.json.camas.ocupadas).toBe(rows[0].n);
    expect(r.json.camas.ocupadas).toBeLessThanOrEqual(r.json.doentes.internados);
  });
});
