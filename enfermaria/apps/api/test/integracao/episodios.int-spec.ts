import { randomUUID } from 'node:crypto';
import { arrancar, parar, entrar, idDe, Contexto } from './app-teste';

/**
 * PROD-02 / PROD-03 — o percurso de internamento de ponta a ponta, contra a BD real:
 * admissão → transferência de serviço → alta → nova admissão da mesma pessoa (reinternar,
 * com as alergias de trás) e pedido de cama da urgência → cama atribuída → ocupada.
 */
describe('integração: episódio de internamento, transferência e pedido de cama', () => {
  let ctx: Contexto;
  const sufixo = randomUUID().slice(0, 6);
  const camas: Record<string, string> = {};

  async function novaCama(chave: string, servico: string, extra: { sexo?: string; isolamento?: boolean } = {}) {
    const id = randomUUID();
    await ctx.bd.query(
      `INSERT INTO camas (id, numero, quarto, estado, servico, sexo, isolamento) VALUES ($1, $2, $3, 'livre', $4, $5, $6)`,
      [id, `EP-${sufixo}-${chave}`, `EP${sufixo}`, servico, extra.sexo ?? null, extra.isolamento ?? false],
    );
    camas[chave] = id;
    return id;
  }

  beforeAll(async () => {
    ctx = await arrancar();
    await novaCama('med1', `MED-${sufixo}`);
    await novaCama('uci1', `UCI-${sufixo}`, { isolamento: true });
    await novaCama('med2', `MED-${sufixo}`);
    await novaCama('masc', `MED-${sufixo}`, { sexo: 'masculino' });
    await novaCama('fem', `MED-${sufixo}`, { sexo: 'feminino' });
  });
  afterAll(async () => { await parar(ctx); });

  const nif = String(200000000 + Math.floor(Math.random() * 99999999)).slice(0, 9);
  let doenteId: string;

  it('admitir com cama abre o episódio n.º 1, com o serviço da cama', async () => {
    const adm = await entrar(ctx, '00007');
    const r = await adm.pedido('POST', '/doentes/admitir', {
      nome: `Doente Episódio ${sufixo}`, dataNascimento: '1948-03-04', diagnosticoPrincipal: 'Pneumonia', camaId: camas['med1'], nif, sexo: 'feminino',
    });
    expect(r.status).toBe(201);
    doenteId = r.json.id;
    const eps = await adm.pedido('GET', `/doentes/${doenteId}/episodios`);
    expect(eps.status).toBe(200);
    expect(eps.json).toHaveLength(1);
    expect(eps.json[0]).toMatchObject({ numero: 1, origem: 'admissao', estado: 'ativo', servico: `MED-${sufixo}`, camaId: camas['med1'] });
    const plano = await ctx.bd.query('SELECT count(*)::int n FROM planos_alta WHERE "episodioId" = $1', [eps.json[0].id]);
    expect(plano.rows[0].n).toBe(1);
  });

  it('transferência para a UCI: cama nova ocupada, antiga em limpeza, movimento e nota de passagem', async () => {
    const adm = await entrar(ctx, '00007');
    expect((await adm.pedido('POST', `/doentes/${doenteId}/transferir`, { camaId: camas['med1'], motivo: 'teste' })).status).toBe(400);
    const r = await adm.pedido('POST', `/doentes/${doenteId}/transferir`, { camaId: camas['uci1'], motivo: 'Agravamento respiratório, necessita de VNI' });
    expect(r.status).toBe(201);
    expect(r.json.movimento).toMatchObject({ tipo: 'servico', deServico: `MED-${sufixo}`, paraServico: `UCI-${sufixo}` });
    const estados = await ctx.bd.query('SELECT id, estado FROM camas WHERE id = ANY($1)', [[camas['med1'], camas['uci1']]]);
    const porId = Object.fromEntries(estados.rows.map((x: any) => [x.id, x.estado]));
    expect(porId).toEqual({ [camas['med1']]: 'em_limpeza', [camas['uci1']]: 'ocupada' });
    const nota = await ctx.bd.query(`SELECT texto FROM notas_turno WHERE "doenteId" = $1 ORDER BY "criadaEm" DESC LIMIT 1`, [doenteId]);
    expect(nota.rows[0].texto).toMatch(/Transferência de serviço/);
  });

  it('alta fecha o episódio; o NIF repetido não cria outra pessoa: pede reinternamento', async () => {
    const adm = await entrar(ctx, '00007');
    expect((await adm.pedido('PATCH', `/doentes/${doenteId}/alta`, {})).status).toBe(200);
    const ep = await ctx.bd.query('SELECT estado, "dataAlta" FROM episodios_internamento WHERE "doenteId" = $1', [doenteId]);
    expect(ep.rows).toEqual([expect.objectContaining({ estado: 'alta', dataAlta: expect.any(Date) })]);
    expect((await adm.pedido('PATCH', `/doentes/${doenteId}/alta`, {})).status).toBe(400); // já teve alta

    const dup = await adm.pedido('POST', '/doentes/admitir', {
      nome: `Doente Episódio ${sufixo}`, dataNascimento: '1948-03-04', diagnosticoPrincipal: 'Queda', nif,
    });
    expect(dup.status).toBe(409);
    expect(dup.json).toMatchObject({ errorCode: 'DOENTE_EXISTENTE_REINTERNAR', contexto: { doenteId } });
  });

  it('reinternar: episódio n.º 2 no mesmo processo, com as alergias de antes por rever', async () => {
    // Alergia registada no internamento anterior (fixture por SQL: o que se testa é que fica).
    await ctx.bd.query(
      `INSERT INTO alergias (id, "doenteId", alergenio, tipo, severidade) VALUES ($1, $2, 'Penicilina', 'medicamento', 'grave')`,
      [randomUUID(), doenteId],
    );
    const adm = await entrar(ctx, '00007');
    // Cama de enfermaria masculina para uma doente: recusa sem justificação.
    const errada = await adm.pedido('POST', `/doentes/${doenteId}/reinternar`, { camaId: camas['masc'], diagnosticoPrincipal: 'Queda' });
    expect(errada.status).toBe(409);
    expect(errada.json.message).toMatch(/CAMA_INCOMPATIVEL/);
    const r = await adm.pedido('POST', `/doentes/${doenteId}/reinternar`, { camaId: camas['fem'], diagnosticoPrincipal: 'Queda com fractura do colo do fémur' });
    expect(r.status).toBe(201);
    expect(r.json.episodio).toMatchObject({ numero: 2, origem: 'reinternamento', alergiasRevistasEm: null });
    expect(r.json.alergiasARever.map((a: any) => a.alergenio)).toContain('Penicilina');
    expect(r.json.doente).toMatchObject({ ativo: true, estadoRegisto: 'internado', camaId: camas['fem'] });

    const ind = await (await entrar(ctx, '00001')).pedido('GET', '/episodios/indicadores/reinternamentos?dias=30');
    expect(ind.status).toBe(200);
    expect(ind.json.reinternamentos).toBeGreaterThanOrEqual(1);
  });

  it('urgência "internado" exige serviço e cria o pedido de cama; atribuir → ocupar abre o episódio', async () => {
    const adm = await entrar(ctx, '00007');
    const doenteUrg = await adm.pedido('POST', '/doentes/admitir', {
      nome: `Doente Urgência ${sufixo}`, dataNascimento: '1960-01-01', diagnosticoPrincipal: 'Dor torácica', sexo: 'masculino',
    });
    expect(doenteUrg.status).toBe(201);
    const urgId = randomUUID();
    await ctx.bd.query(
      `INSERT INTO episodios_urgencia (id, "doenteId", "queixaPrincipal", triagem, "estadoEpisodio", "triadoPorId")
       VALUES ($1, $2, 'Dor torácica', 'laranja', 'em_atendimento', $3)`,
      [urgId, doenteUrg.json.id, await idDe(ctx, '00003')],
    );
    const med = await entrar(ctx, '00013');
    expect((await med.pedido('PATCH', `/urgencia/${urgId}/estado`, { estado: 'internado' })).status).toBe(400);
    expect((await med.pedido('PATCH', `/urgencia/${urgId}/estado`, { estado: 'internado', servicoDestino: `MED-${sufixo}` })).status).toBe(200);

    const pedidos = await adm.pedido('GET', `/pedidos-cama?servico=MED-${sufixo}`);
    const pedido = pedidos.json.find((p: any) => p.episodioUrgenciaId === urgId);
    expect(pedido).toMatchObject({ origem: 'urgencia', estado: 'pedido', prioridade: 'urgente', sexo: 'masculino' });

    expect((await adm.pedido('POST', `/pedidos-cama/${pedido.id}/ocupar`, {})).status).toBe(400); // sem cama atribuída
    expect((await adm.pedido('PATCH', `/pedidos-cama/${pedido.id}/atribuir`, { camaId: camas['med2'] })).status).toBe(200);
    const reservada = await ctx.bd.query('SELECT estado, "reservadaPedidoId" FROM camas WHERE id = $1', [camas['med2']]);
    expect(reservada.rows[0]).toEqual({ estado: 'reservada', reservadaPedidoId: pedido.id });

    const ocupado = await adm.pedido('POST', `/pedidos-cama/${pedido.id}/ocupar`, {});
    expect(ocupado.status).toBe(201);
    expect(ocupado.json).toMatchObject({ estado: 'ocupada' });
    const ep = await ctx.bd.query('SELECT origem, estado, "episodioUrgenciaId", "pedidoCamaId" FROM episodios_internamento WHERE "doenteId" = $1', [doenteUrg.json.id]);
    expect(ep.rows).toEqual([{ origem: 'urgencia', estado: 'ativo', episodioUrgenciaId: urgId, pedidoCamaId: pedido.id }]);
    const d = await ctx.bd.query('SELECT "estadoRegisto", "camaId" FROM doentes WHERE id = $1', [doenteUrg.json.id]);
    expect(d.rows[0]).toEqual({ estadoRegisto: 'internado', camaId: camas['med2'] });

    const ind = await adm.pedido('GET', '/pedidos-cama/indicadores');
    expect(ind.status).toBe(200);
    expect(ind.json.ocupados).toBeGreaterThanOrEqual(1);
  });
});
