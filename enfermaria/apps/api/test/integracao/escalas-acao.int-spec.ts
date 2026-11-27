import { arrancar, parar, entrar, criarDoenteInternado, Contexto } from './app-teste';

/**
 * PROD-21 — o resultado de uma escala desencadeia a ação: NRS-2002 ≥ 3 gera a referenciação à
 * nutrição como tarefa do turno, e uma reavaliação não a repete enquanto estiver aberta.
 */
describe('integração: escala → ação', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('NRS-2002 em risco gera uma tarefa de nutrição, sem duplicar na reavaliação', async () => {
    const { doenteId } = await criarDoenteInternado(ctx, ['00003']);
    const enf = await entrar(ctx, '00003');

    const r1 = await enf.pedido('POST', `/escalas-clinicas/${doenteId}`, { tipo: 'NRS2002', valores: { estado_nutricional: 2, gravidade: 1, idade: 1 } });
    expect(r1.status).toBe(201);
    expect(r1.json.pontuacao).toBe(4);
    expect(r1.json.acoesGeradas).toHaveLength(1);
    expect(r1.json.acoesGeradas[0].descricao).toMatch(/^Nutrição \(NRS-2002\)/);

    const r2 = await enf.pedido('POST', `/escalas-clinicas/${doenteId}`, { tipo: 'NRS2002', valores: { estado_nutricional: 3, gravidade: 1, idade: 1 } });
    expect(r2.json.acoesGeradas).toEqual([]);

    const { rows } = await ctx.bd.query(
      `SELECT prioridade, "grupoResponsavel", prazo IS NOT NULL AS com_prazo FROM tarefas WHERE "doenteId" = $1 AND descricao LIKE 'Nutrição (NRS-2002)%'`, [doenteId]);
    expect(rows).toEqual([{ prioridade: 'alta', grupoResponsavel: 'enfermeiro', com_prazo: true }]);
  });

  it('sem risco não gera nada', async () => {
    const { doenteId } = await criarDoenteInternado(ctx, ['00003']);
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('POST', `/escalas-clinicas/${doenteId}`, { tipo: 'NRS2002', valores: { estado_nutricional: 0, gravidade: 1, idade: 0 } });
    expect(r.status).toBe(201);
    expect(r.json.acoesGeradas).toEqual([]);
  });
});
