import { arrancar, parar, entrar, criarDoenteInternado, Contexto, DoenteFixture } from './app-teste';

/**
 * PROD-07 — processo de enfermagem de ponta a ponta, contra a BD real: catálogo base →
 * avaliação inicial → escala que sugere o diagnóstico → conjunto tipo aplicado → registo
 * devido no turno ("O meu turno") → execução → reavaliação "resolvido" → plano vazio.
 */
describe('integração: processo de enfermagem (plano de cuidados)', () => {
  let ctx: Contexto;
  let d: DoenteFixture;

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003']);
  });
  afterAll(async () => { await parar(ctx); });

  it('jornada: avaliação inicial, sugestão pela Braden, conjunto, execução e reavaliação', async () => {
    const chefe = await entrar(ctx, '00015');
    const imp = await chefe.pedido('POST', '/processo-enfermagem/catalogo/importar-base', {});
    expect(imp.status).toBe(201);
    expect(imp.json).toMatchObject({ conjuntos: 4 });
    // Idempotente.
    expect((await chefe.pedido('POST', '/processo-enfermagem/catalogo/importar-base', {})).json.criados).toBe(0);

    const enf = await entrar(ctx, '00003');
    const av = await enf.pedido('PUT', `/processo-enfermagem/doente/${d.doenteId}/avaliacao-inicial`, {
      dados: { mobilidade: 'acamado', pele: 'íntegra', cuidador: { nome: 'Filha', contacto: '91x' } }, completa: true,
    });
    expect(av.status).toBe(200);

    // Uma Braden de risco sugere "Úlcera por pressão".
    const braden = await enf.pedido('POST', `/escalas/${d.doenteId}`, { tipo: 'braden', itens: { percepcaoSensorial: 2, humidade: 2, atividade: 1, mobilidade: 2, nutricao: 2, friccaoCisalhamento: 1 } });
    expect([200, 201]).toContain(braden.status);
    let plano = await enf.pedido('GET', `/processo-enfermagem/doente/${d.doenteId}/plano`);
    expect(plano.status).toBe(200);
    expect(plano.json.avaliacaoInicial).toMatchObject({ completa: true });
    const sug = plano.json.sugestoes.find((s: any) => s.diagnostico === 'Úlcera por pressão');
    expect(sug).toMatchObject({ conjunto: 'Risco de úlcera por pressão' });

    // O enfermeiro aceita: aplica o conjunto.
    const conjuntos = (await enf.pedido('GET', '/processo-enfermagem/conjuntos')).json;
    const cj = conjuntos.find((c: any) => c.nome === 'Risco de úlcera por pressão');
    const ap = await enf.pedido('POST', `/processo-enfermagem/doente/${d.doenteId}/conjuntos/${cj.id}`, {});
    expect(ap.status).toBe(201);
    expect(ap.json.criados).toEqual(['Úlcera por pressão']);

    plano = await enf.pedido('GET', `/processo-enfermagem/doente/${d.doenteId}/plano`);
    const dg = plano.json.diagnosticos[0];
    expect(dg).toMatchObject({ termo: 'Úlcera por pressão', juizo: 'risco', origem: 'conjunto' });
    expect(dg.intervencoes.map((i: any) => i.frequencia).sort()).toEqual(['1x/dia', '1x/dia', '3/3h']);
    expect(plano.json.sugestoes.find((s: any) => s.diagnostico === 'Úlcera por pressão')).toBeUndefined();

    // Execução (hora do ato há 30 min) e "não realizada" com motivo.
    const posicionar = dg.intervencoes.find((i: any) => i.frequencia === '3/3h');
    const ex = await enf.pedido('POST', `/processo-enfermagem/intervencoes/${posicionar.id}/execucoes`, { executadaEm: new Date(Date.now() - 30 * 60_000).toISOString(), nota: 'Decúbito lateral esquerdo' });
    expect(ex.status).toBe(201);
    const nr = await enf.pedido('POST', `/processo-enfermagem/intervencoes/${posicionar.id}/execucoes`, { realizada: false });
    expect(nr.status).toBe(400);

    // "O meu turno" traz o contador de cuidados de enfermagem.
    const turno = await enf.pedido('GET', '/resumo/meu-turno');
    const linha = turno.json.doentes.find((l: any) => l.doente.id === d.doenteId);
    expect(linha.cuidados).toEqual({ devidas: expect.any(Number), emAtraso: expect.any(Number) });

    // Reavaliação "resolvido" encerra o diagnóstico e as intervenções.
    const rv = await enf.pedido('POST', `/processo-enfermagem/diagnosticos/${dg.id}/avaliacoes`, { evolucao: 'resolvido', nota: 'Pele íntegra, Braden 19' });
    expect(rv.status).toBe(201);
    plano = await enf.pedido('GET', `/processo-enfermagem/doente/${d.doenteId}/plano`);
    expect(plano.json.diagnosticos).toEqual([]);
    const ints = await ctx.bd.query(`SELECT estado FROM intervencoes_enfermagem WHERE "diagnosticoId" = $1`, [dg.id]);
    expect(ints.rows.every((r: any) => r.estado === 'concluida')).toBe(true);
  });

  it('acesso: um enfermeiro sem o doente não vê nem altera o plano; o médico só lê', async () => {
    const outro = await entrar(ctx, '00014');
    expect((await outro.pedido('GET', `/processo-enfermagem/doente/${d.doenteId}/plano`)).status).toBe(403);
    expect((await outro.pedido('POST', `/processo-enfermagem/doente/${d.doenteId}/diagnosticos`, { termo: 'Dor' })).status).toBe(403);
    const dx = await ctx.bd.query(`SELECT id FROM intervencoes_enfermagem WHERE "doenteId" = $1 LIMIT 1`, [d.doenteId]);
    expect((await outro.pedido('POST', `/processo-enfermagem/intervencoes/${dx.rows[0].id}/execucoes`, {})).status).toBe(403);
    const medico = await entrar(ctx, '00013');
    expect((await medico.pedido('POST', `/processo-enfermagem/doente/${d.doenteId}/diagnosticos`, { termo: 'Dor' })).status).toBe(403);
  });
});
