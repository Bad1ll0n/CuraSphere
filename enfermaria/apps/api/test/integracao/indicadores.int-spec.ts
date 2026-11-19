import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, idDe, Contexto } from './app-teste';

/**
 * PROD-18 — indicadores de enfermagem contra a BD real, num serviço só deste teste e num período
 * fixo (2031-05), com casos construídos à mão: cada número tem de dar exatamente o esperado.
 * E a notificação anónima de incidentes com ICPS, exportada para o NOTIFICA.
 */
describe('integração: indicadores de enfermagem e NOTIFICA', () => {
  let ctx: Contexto;
  const S = `INT-IND-${Date.now()}`;
  const q = `inicio=2031-05-01&fim=2031-05-11&servico=${encodeURIComponent(S)}`;
  const ids: Record<string, string> = {};

  const doente = async (nome: string) => {
    const id = randomUUID();
    await ctx.bd.query(`INSERT INTO doentes (id, nome, "numeroProcesso", "estadoRegisto", "dataAdmissao") VALUES ($1, $2, $3, 'internado', '2031-05-01')`, [id, nome, `IND-${id.slice(0, 8)}`]);
    return id;
  };
  const episodio = async (doenteId: string, numero: number, adm: string, alta: string | null, extra: { motivoAlta?: string; urgenciaId?: string } = {}) => {
    await ctx.bd.query(
      `INSERT INTO episodios_internamento (id, "doenteId", numero, origem, estado, servico, "dataAdmissao", "dataAlta", "motivoAlta", "episodioUrgenciaId") VALUES ($1, $2, $3, 'admissao', $4, $5, $6, $7, $8, $9)`,
      [randomUUID(), doenteId, numero, alta ? 'alta' : 'ativo', S, adm, alta, extra.motivoAlta ?? null, extra.urgenciaId ?? null],
    );
  };

  beforeAll(async () => {
    ctx = await arrancar();
    const enf = await idDe(ctx, '00003');
    // A: internado 1→11 (10 dias), uma queda, Morse e Braden nas primeiras 24 h, UPP adquirida ao dia 4.
    ids.A = await doente('Doente A');
    await episodio(ids.A, 1, '2031-05-01T00:00:00Z', null);
    await ctx.bd.query(`INSERT INTO eventos_adversos (id, tipo, gravidade, descricao, "doenteId", "ocorridoEm", "atualizadoEm") VALUES ($1, 'queda', 'dano_leve', 'Queda', $2, '2031-05-03T04:00:00Z', now())`, [randomUUID(), ids.A]);
    for (const tipo of ['morse', 'braden']) {
      await ctx.bd.query(`INSERT INTO avaliacoes_risco (id, "doenteId", tipo, pontuacao, itens, risco, "registadoPorId", "criadaEm") VALUES ($1, $2, $3, 10, '{}', 'alto', $4, '2031-05-01T06:00:00Z')`, [randomUUID(), ids.A, tipo, enf]);
    }
    await ctx.bd.query(`INSERT INTO avaliacoes_feridas (id, "doenteId", "registadoPorId", tipo, localizacao, "estadoCicatrizacao", "criadaEm", "updatedAt") VALUES ($1, $2, $3, 'ulcera_pressao', 'sacro', 'fase_inflamacao', '2031-05-04T10:00:00Z', now())`, [randomUUID(), ids.A, enf]);
    // B: internado 1→6 (5 dias) com UPP presente na admissão (não conta) e só Morse (falha a avaliação 24 h); alta e reinternamento a 6→11.
    ids.B = await doente('Doente B');
    await episodio(ids.B, 1, '2031-05-01T00:00:00Z', '2031-05-06T00:00:00Z', { motivoAlta: 'domicilio' });
    await episodio(ids.B, 2, '2031-05-09T00:00:00Z', null);
    await ctx.bd.query(`INSERT INTO avaliacoes_feridas (id, "doenteId", "registadoPorId", tipo, localizacao, "estadoCicatrizacao", "criadaEm", "updatedAt") VALUES ($1, $2, $3, 'ulcera_pressao', 'calcâneo', 'fase_inflamacao', '2031-05-01T08:00:00Z', now())`, [randomUUID(), ids.B, enf]);
    await ctx.bd.query(`INSERT INTO avaliacoes_risco (id, "doenteId", tipo, pontuacao, itens, risco, "registadoPorId", "criadaEm") VALUES ($1, $2, 'morse', 10, '{}', 'alto', $3, '2031-05-01T06:00:00Z')`, [randomUUID(), ids.B, enf]);
    // C: vem da urgência (entrada 2031-05-02 08:00, cama às 12:00 → 240 min), CVC com cultura positiva ao 3.º dia.
    ids.C = await doente('Doente C');
    const urg = randomUUID();
    await ctx.bd.query(`INSERT INTO episodios_urgencia (id, "doenteId", "queixaPrincipal", triagem, "triadoPorId", "dataEntrada") VALUES ($1, $2, 'Dispneia', 'laranja', $3, '2031-05-02T08:00:00Z')`, [urg, ids.C, enf]);
    await episodio(ids.C, 1, '2031-05-02T12:00:00Z', '2031-05-07T12:00:00Z', { motivoAlta: 'obito', urgenciaId: urg });
    await ctx.bd.query(`INSERT INTO dispositivos_invasivos (id, "doenteId", tipo, "dataInsercao", "dataRemocao", ativo, "inseridoPorId") VALUES ($1, $2, 'cateter_venoso_central', '2031-05-02T13:00:00Z', '2031-05-07T10:00:00Z', false, $3)`, [randomUUID(), ids.C, enf]);
    await ctx.bd.query(`INSERT INTO culturas_microbiologicas (id, "doenteId", "dataColheita", "tipoAmostra", agente, resultado, "registadoPorId") VALUES ($1, $2, '2031-05-05T09:00:00Z', 'hemocultura', 'S. aureus', 'positivo', $3)`, [randomUUID(), ids.C, enf]);
  });
  afterAll(async () => { await parar(ctx); });

  it('cada indicador dá o valor esperado (numerador / denominador)', async () => {
    const chefe = await entrar(ctx, '00015');
    const r = await chefe.pedido('GET', `/indicadores?${q}`);
    expect(r.status).toBe(200);
    // Dias: A 10 + B 5 + B 2 (9→11) + C 5 = 22.
    expect(r.json.diasInternamento).toBe(22);
    const v = Object.fromEntries(r.json.indicadores.map((i: any) => [i.codigo, i]));
    expect(v.quedas).toMatchObject({ numeradorValor: 1, valor: 45.45, versao: '1' });
    expect(v.upp_adquiridas).toMatchObject({ numeradorValor: 1 }); // a de B estava presente na admissão
    // Elegíveis (≥ 24 h, admitidos no período): A, B1, B2, C → só A tem Morse e Braden em 24 h.
    expect(v.avaliacao_risco_24h).toMatchObject({ numeradorValor: 1, denominadorValor: 4, valor: 25 });
    // Altas no período: B1 (domicílio, reinternado ao fim de 3 dias) e C (óbito, excluída).
    expect(v.reinternamento_30d).toMatchObject({ numeradorValor: 1, denominadorValor: 1, valor: 100 });
    expect(v.tempo_urgencia_cama).toMatchObject({ valor: 240, denominadorValor: 1 });
    expect(v.infecao_dispositivo).toMatchObject({ numeradorValor: 1 });
    expect(v.infecao_dispositivo.denominadorValor).toBeCloseTo(4.9, 1);
    expect(v.dor_por_turno.denominadorValor).toBeGreaterThan(0);
    expect(v.dor_por_turno.numeradorValor).toBe(0);
  });

  it('drill-down até ao doente e CSV', async () => {
    const chefe = await entrar(ctx, '00015');
    const r = await chefe.pedido('GET', `/indicadores?${q}&codigo=avaliacao_risco_24h`);
    expect(r.json.indicadores).toHaveLength(1);
    // Num indicador "alto é melhor" mostram-se os que falharam.
    expect(r.json.indicadores[0].casos.map((c: any) => c.nome).sort()).toEqual(['Doente B', 'Doente B', 'Doente C']);
    expect((await fetch(`${ctx.url}/indicadores/exportar?${q}`)).status).toBe(401); // sem sessão
    const csvSessao = await chefe.pedido('GET', `/indicadores/exportar?${q}`);
    expect(csvSessao.status).toBe(200);
    expect(csvSessao.cabecalhos.get('content-type')).toMatch(/text\/csv/);
    const csvCasos = await fetch(`${ctx.url}/indicadores/exportar?${q}&codigo=quedas`);
    expect(csvCasos.status).toBe(401);
  });

  it('acesso: um enfermeiro sem chefia não vê os indicadores', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('GET', `/indicadores?${q}`)).status).toBe(403);
  });

  it('incidente anónimo com ICPS e exportação NOTIFICA sem identificação, sem repetir os já exportados', async () => {
    const enf = await entrar(ctx, '00003');
    const ev = await enf.pedido('POST', '/eventos-adversos', { tipo: 'erro_medicacao', gravidade: 'sem_dano', descricao: 'Dose trocada detetada antes de administrar', anonimo: true, ocorridoEm: '2031-05-04T10:00:00Z' });
    expect(ev.status).toBe(201);
    const row = await ctx.bd.query(`SELECT "registadoPorId", anonimo, "classeIcps" FROM eventos_adversos WHERE id = $1`, [ev.json.id]);
    expect(row.rows[0]).toEqual({ registadoPorId: null, anonimo: true, classeIcps: 'medicacao_fluidos' });
    expect((await enf.pedido('POST', '/eventos-adversos', { tipo: 'outro', gravidade: 'sem_dano', descricao: 'x', classeIcps: 'inexistente' })).status).toBe(400);

    const chefe = await entrar(ctx, '00015');
    const previa = await chefe.pedido('GET', '/eventos-adversos/exportar-notifica?inicio=2031-05-01&fim=2031-05-11');
    expect(previa.json).toMatchObject({ formato: 'NOTIFICA/ICPS' });
    const inc = previa.json.incidentes.find((i: any) => i.referenciaInterna === ev.json.id);
    expect(inc).toMatchObject({ tipoIncidenteIcps: 'medicacao_fluidos', grauDano: 'nenhum' });
    expect(Object.keys(inc).some((k) => /doente|registadoPor/i.test(k))).toBe(false);

    const exp = await chefe.pedido('POST', '/eventos-adversos/exportar-notifica?inicio=2031-05-01&fim=2031-05-11&soNovos=true', {});
    expect(exp.status).toBe(201);
    expect(exp.json.total).toBeGreaterThanOrEqual(2);
    const outra = await chefe.pedido('POST', '/eventos-adversos/exportar-notifica?inicio=2031-05-01&fim=2031-05-11&soNovos=true', {});
    expect(outra.json.total).toBe(0);
    expect((await enf.pedido('POST', '/eventos-adversos/exportar-notifica?inicio=2031-05-01&fim=2031-05-11', {})).status).toBe(403);
  });
});
