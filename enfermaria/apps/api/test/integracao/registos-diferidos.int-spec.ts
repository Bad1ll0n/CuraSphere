import { arrancar, parar, entrar, idDe, criarDoenteInternado, Contexto, DoenteFixture } from './app-teste';

/**
 * PROD-15 e PROD-16, contra a BD real.
 *  - Monitores: a leitura fica pendente (não entra no NEWS2), o doente vem da cama a que o
 *    monitor está ligado, as duas vias (/monitorizacao/ingerir e /fhir/Observation) dão no
 *    mesmo sítio, e o enfermeiro valida (fica autor) ou rejeita como artefacto.
 *  - Hora do ato: a administração offline guarda a hora do ato e a do registo; um registo
 *    diferido sem os 5 certos confirmados é recusado; fora da janela, também.
 */
describe('integração: leituras de monitor e registos diferidos', () => {
  let ctx: Contexto;
  let d: DoenteFixture;

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003', '00013']);
  });
  afterAll(async () => { await parar(ctx); });

  /** Pedido de um dispositivo: sem sessão nem cookies, só a chave. */
  const doDispositivo = async (caminho: string, cabecalho: Record<string, string>, corpo: unknown) => {
    const r = await fetch(ctx.url + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalho }, body: JSON.stringify(corpo) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  it('PROD-15: leituras pendentes pelas duas vias, validação em lote e rejeição como artefacto', async () => {
    const ti = await entrar(ctx, '00009');
    const disp = await ti.pedido('POST', '/monitorizacao/dispositivos', { nome: 'Monitor INT', responsavelId: await idDe(ctx, '00009'), camaId: d.camaId });
    expect(disp.status).toBe(201);
    const chave = { 'x-device-key': disp.json.apiKey };

    // O payload não escolhe o doente.
    const outro = await criarDoenteInternado(ctx);
    expect((await doDispositivo('/monitorizacao/ingerir', chave, { doenteId: outro.doenteId, pulso: 80 })).status).toBe(400);

    // Leitura crítica (SpO₂ 85): pendente, com alerta a pedir confirmação — sem sinal vital.
    const medidoEm = new Date(Date.now() - 20 * 60_000).toISOString();
    const ing = await doDispositivo('/monitorizacao/ingerir', chave, { saturacaoO2: 85, pulso: 96, medidoEm });
    expect(ing.status).toBe(201);
    expect(ing.json).toMatchObject({ estado: 'pendente_validacao', critica: true });
    const sv0 = await ctx.bd.query('SELECT count(*)::int AS n FROM sinais_vitais WHERE "doenteId" = $1', [d.doenteId]);
    expect(sv0.rows[0].n).toBe(0);
    const al = await ctx.bd.query(`SELECT count(*)::int AS n FROM alertas_clinicos WHERE "doenteId" = $1 AND tipo = 'leitura_monitor_critica'`, [d.doenteId]);
    expect(al.rows[0].n).toBe(1);

    // Via FHIR, ligada à mesma cama → mesma fila.
    const fhir = await ti.pedido('POST', '/fhir/dispositivos', { nome: 'Gateway INT', tipo: 'monitor_vitais', camaId: d.camaId });
    expect(fhir.status).toBe(201);
    const obs = await doDispositivo('/fhir/Observation', { 'x-device-api-key': fhir.json.apiKey }, {
      resourceType: 'Observation', code: { coding: [{ code: '8867-4' }] }, valueQuantity: { value: 140 },
    });
    expect(obs.status).toBe(201);
    expect(obs.json).toMatchObject({ status: 'pendente_validacao' });

    const enf = await entrar(ctx, '00003');
    const pend = await enf.pedido('GET', `/monitorizacao/doente/${d.doenteId}/leituras-pendentes`);
    expect(pend.status).toBe(200);
    expect(pend.json).toHaveLength(2);
    const [doFhir, doMonitor] = [pend.json.find((l: any) => l.canal === 'fhir'), pend.json.find((l: any) => l.canal === 'monitor')];

    // Um auxiliar não valida.
    const aux = await entrar(ctx, '00004');
    expect((await aux.pedido('POST', `/monitorizacao/doente/${d.doenteId}/leituras/validar`, { ids: [doMonitor.id] })).status).toBe(403);

    // Validar: passa a sinal vital, com o enfermeiro como autor e o monitor como origem.
    const val = await enf.pedido('POST', `/monitorizacao/doente/${d.doenteId}/leituras/validar`, { ids: [doMonitor.id] });
    expect(val.status).toBe(201);
    expect(val.json).toEqual({ validadas: 1, falhas: [] });
    const sv = await ctx.bd.query('SELECT "registadoPorId", origem, "dispositivoId", data, news2 FROM sinais_vitais WHERE "doenteId" = $1', [d.doenteId]);
    expect(sv.rows).toHaveLength(1);
    expect(sv.rows[0]).toMatchObject({ registadoPorId: await idDe(ctx, '00003'), origem: 'monitor', dispositivoId: disp.json.id });
    expect(new Date(sv.rows[0].data).toISOString()).toBe(medidoEm);
    // Validar de novo não duplica.
    expect((await enf.pedido('POST', `/monitorizacao/doente/${d.doenteId}/leituras/validar`, { ids: [doMonitor.id] })).json.validadas).toBe(0);

    // Rejeitar como artefacto.
    expect((await enf.pedido('POST', `/monitorizacao/doente/${d.doenteId}/leituras/rejeitar`, { ids: [doFhir.id], motivo: 'ok' })).status).toBe(400);
    const rej = await enf.pedido('POST', `/monitorizacao/doente/${d.doenteId}/leituras/rejeitar`, { ids: [doFhir.id], motivo: 'Doente a mexer-se, sensor solto' });
    expect(rej.json).toEqual({ rejeitadas: 1 });
    const est = await ctx.bd.query('SELECT estado, "motivoRejeicao" FROM leituras_monitor WHERE id = $1', [doFhir.id]);
    expect(est.rows[0]).toEqual({ estado: 'rejeitada', motivoRejeicao: 'Doente a mexer-se, sensor solto' });
    expect((await enf.pedido('GET', `/monitorizacao/doente/${d.doenteId}/leituras-pendentes`)).json).toHaveLength(0);

    // Cama vazia: o monitor não tem a quem atribuir a leitura.
    await ctx.bd.query('UPDATE doentes SET "camaId" = NULL WHERE id = $1', [outro.doenteId]);
    const dispVazia = await ti.pedido('POST', '/monitorizacao/dispositivos', { nome: 'Monitor cama vazia', responsavelId: await idDe(ctx, '00009'), camaId: outro.camaId });
    expect((await doDispositivo('/monitorizacao/ingerir', { 'x-device-key': dispVazia.json.apiKey }, { pulso: 80 })).status).toBe(400);
  });

  it('PROD-16: administração diferida guarda a hora do ato, exige os 5 certos e respeita a janela', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('POST', `/alergias/${d.doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' })).status).toBe(201);
    const med = await entrar(ctx, '00013');
    const p = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Amoxicilina 500mg', dose: '500 mg', via: 'oral', frequencia: '3x/dia' });
    expect(p.status).toBe(201);
    const far = await entrar(ctx, '00006');
    expect((await far.pedido('PATCH', `/medicacao/${p.json.id}/validar`, {})).status).toBe(200);

    const ato = new Date(Date.now() - 3 * 3_600_000).toISOString();
    // Diferido sem os 5 certos (o que a fila offline enviava): recusado.
    const semCertos = await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, ocorridoEm: ato });
    expect(semCertos.status).toBe(400);
    expect(semCertos.json.message).toMatch(/REGISTO_DIFERIDO/);
    // Fora da janela: recusado.
    const antigo = new Date(Date.now() - 13 * 3_600_000).toISOString();
    expect((await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, ocorridoEm: antigo, atestadoPeloEnfermeiro: true })).status).toBe(400);

    const a = await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, ocorridoEm: ato, atestadoPeloEnfermeiro: true });
    expect(a.status).toBe(201);
    const r = await ctx.bd.query('SELECT "administradoEm", "registadoEm" FROM registos_medicacao WHERE id = $1', [a.json.id]);
    expect(new Date(r.rows[0].administradoEm).toISOString()).toBe(ato);
    expect(Date.now() - new Date(r.rows[0].registadoEm).getTime()).toBeLessThan(60_000);

    // A hora certa conta-se a partir do ATO: 3x/dia (8/8h), a toma das -3 h impede uma agora.
    const agora = await enf.pedido('POST', `/medicacao/${p.json.id}/administrar`, { doenteId: d.doenteId, atestadoPeloEnfermeiro: true });
    expect(agora.status).toBe(400);
    expect(agora.json.message).toMatch(/prematura/);

    // A medicação do doente (o que o MAR e a ficha mostram) traz as duas horas.
    const lista = await enf.pedido('GET', `/medicacao/doente/${d.doenteId}`);
    const linha = lista.json.find((m: any) => m.id === p.json.id);
    expect(linha.registos[0]).toMatchObject({ administradoEm: ato, registadoEm: expect.any(String) });
  });

  it('PROD-16: sinais vitais fora da janela de registo diferido são recusados', async () => {
    const enf = await entrar(ctx, '00003');
    const antigo = new Date(Date.now() - 13 * 3_600_000).toISOString();
    const r = await enf.pedido('POST', `/sinais-vitais/${d.doenteId}`, { pulso: 80, medidoEm: antigo });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/nota retrospetiva/);
  });
});
