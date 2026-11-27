import { arrancar, parar, entrar, criarDoenteInternado, idDe, Contexto, DoenteFixture } from './app-teste';

/**
 * QA-20 (e) — os 5 certos e a segurança da prescrição, de ponta a ponta: prescrever →
 * validar (farmácia) → administrar → registo; alergia que bloqueia; SOS com intervalo.
 */
describe('integração: medicação segura', () => {
  let ctx: Contexto;
  let d: DoenteFixture;
  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003', '00013']);
  });
  afterAll(async () => { await parar(ctx); });

  it('alergia a paracetamol bloqueia "Ben-u-ron" (marca comercial, QA-06)', async () => {
    const med = await entrar(ctx, '00013');
    expect((await med.pedido('POST', `/alergias/${d.doenteId}`, { alergenio: 'Paracetamol', tipo: 'medicamento', severidade: 'anafilaxia' })).status).toBe(201);
    const r = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Ben-u-ron', dose: '1 g', via: 'oral', frequencia: '3x/dia' });
    expect(r.status).toBe(409);
    expect(r.json.message).toMatch(/paracetamol/i);
  });

  it('prescrição implausível não é gravada (QA-07): dose ilegível → 400, dose absurda → 409', async () => {
    const med = await entrar(ctx, '00013');
    const ilegivel = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Amoxicilina', dose: 'muita', via: 'oral', frequencia: '3x/dia' });
    expect(ilegivel.status).toBe(400);
    const absurda = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Amoxicilina', dose: '500 g', via: 'oral', frequencia: '3x/dia' });
    expect(absurda.status).toBe(409);
    const gravadas = await ctx.bd.query(`SELECT count(*)::int n FROM medicacoes WHERE "doenteId"=$1 AND dose IN ('muita', '500 g')`, [d.doenteId]);
    expect(gravadas.rows[0].n).toBe(0);
  });

  it('jornada completa: prescrever → validar → administrar com os 5 certos → registo', async () => {
    const med = await entrar(ctx, '00013');
    const p = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Amoxicilina 500mg', dose: '500 mg', via: 'oral', frequencia: '3x/dia' });
    expect(p.status).toBe(201);

    const far = await entrar(ctx, '00006');
    const pend = await far.pedido('GET', '/medicacao/pendentes-validacao');
    expect(pend.json.map((m: any) => m.id)).toContain(p.json.id);
    expect((await far.pedido('PATCH', `/medicacao/${p.json.id}/validar`, {})).status).toBe(200);

    const enf = await entrar(ctx, '00003');
    // Doente errado: 1.º certo.
    const errado = await criarDoenteInternado(ctx, ['00003']);
    expect((await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: errado.doenteId, atestadoPeloEnfermeiro: true })).status).toBe(400);
    // Sem doente: recusado.
    expect((await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { atestadoPeloEnfermeiro: true })).status).toBe(400);

    const a = await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, atestadoPeloEnfermeiro: true });
    expect(a.status).toBe(201);
    const reg = await ctx.bd.query('SELECT "administradoPorId" FROM registos_medicacao WHERE id=$1', [a.json.id]);
    expect(reg.rows[0].administradoPorId).toBe(await idDe(ctx, '00003'));
  });

  it('um enfermeiro sem o doente atribuído não administra (QA-01)', async () => {
    const med = await entrar(ctx, '00013');
    const p = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Omeprazol 20mg', dose: '20 mg', via: 'oral', frequencia: '1x/dia' });
    const outro = await entrar(ctx, '00014');
    expect((await outro.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, atestadoPeloEnfermeiro: true })).status).toBe(403);
  });

  it('SOS: exige intervalo mínimo; segunda toma seguida só com justificação (QA-08)', async () => {
    const med = await entrar(ctx, '00013');
    expect((await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Metoclopramida', dose: '10 mg', via: 'iv', frequencia: 'SOS' })).status).toBe(400);
    const sos = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Metoclopramida', dose: '10 mg', via: 'iv', frequencia: 'SOS', intervaloMinimoH: 8, maxDosesDia: 3 });
    expect(sos.status).toBe(201);
    const enf = await entrar(ctx, '00003');
    const adm = (extra = {}) => enf.pedido('POST', `/medicacao/${sos.json.id}/administrar`, { doenteId: d.doenteId, atestadoPeloEnfermeiro: true, ...extra });
    expect((await adm()).status).toBe(201);
    expect((await adm()).status).toBe(409);
    expect((await adm({ justificacaoSOS: 'Vómitos incoercíveis, médico informado' })).status).toBe(201);
  });

  it('sem avaliação de alergias não se prescreve; "sem alergias conhecidas" desbloqueia (PROD-06)', async () => {
    const novo = await criarDoenteInternado(ctx, ['00003', '00013']);
    const med = await entrar(ctx, '00013');
    const prescrever = () => med.pedido('POST', '/medicacao/prescrever', { doenteId: novo.doenteId, nome: 'Omeprazol 20mg', dose: '20 mg', via: 'oral', frequencia: '1x/dia' });
    expect((await med.pedido('GET', `/alergias/${novo.doenteId}/avaliacao`)).json.estado).toBe('nao_avaliado');
    const bloqueada = await prescrever();
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.json.message).toMatch(/ALERGIAS_NAO_AVALIADAS/);
    const enf = await entrar(ctx, '00003');
    const av = await enf.pedido('POST', `/alergias/${novo.doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' });
    expect([av.status, av.json.estado]).toEqual([201, 'sem_alergias_conhecidas']);
    expect((await prescrever()).status).toBe(201);
    // Com uma alergia registada já não se pode dizer "sem alergias".
    expect((await med.pedido('POST', `/alergias/${novo.doenteId}`, { alergenio: 'Látex', tipo: 'latex', severidade: 'leve' })).status).toBe(201);
    expect((await enf.pedido('POST', `/alergias/${novo.doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' })).status).toBe(409);
  });
});
