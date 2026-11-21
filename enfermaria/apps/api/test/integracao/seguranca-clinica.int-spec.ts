import { arrancar, parar, entrar, criarDoenteInternado, idDe, Contexto, DoenteFixture, Sessao } from './app-teste';

/**
 * QA-09, QA-14, QA-15 e QA-16 contra a BD real: administrações concorrentes, descontinuar com
 * autor e motivo, administração antes da validação farmacêutica e coerência dos sinais vitais.
 */
describe('integração: segurança clínica (medicação e sinais vitais)', () => {
  let ctx: Contexto;
  let d: DoenteFixture;
  let med: Sessao;
  let enf: Sessao;
  let far: Sessao;
  const modoOriginal = process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'];

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003', '00013']);
    med = await entrar(ctx, '00013');
    enf = await entrar(ctx, '00003');
    far = await entrar(ctx, '00006');
    // A prescrição exige a avaliação de alergias registada.
    expect((await med.pedido('POST', `/alergias/${d.doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' })).status).toBe(201);
  });
  afterEach(() => {
    if (modoOriginal === undefined) delete process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'];
    else process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'] = modoOriginal;
  });
  afterAll(async () => { await parar(ctx); });

  const prescrever = async (nome = 'Omeprazol 20mg', frequencia = '1x/dia') => {
    const sos = frequencia === 'SOS' ? { intervaloMinimoH: 4, maxDosesDia: 4 } : {};
    const p = await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome, dose: '20 mg', via: 'oral', frequencia, ...sos });
    expect(p.status).toBe(201);
    return p.json.id as string;
  };
  const administrar = (id: string, extra = {}) =>
    enf.pedido('POST', `/medicacao/${id}/administrar`, { doenteId: d.doenteId, atestadoPeloEnfermeiro: true, ...extra });

  describe('QA-15 — administração antes da validação farmacêutica', () => {
    it('primeira_dose (omissão): sem justificação 409; 1.ª dose justificada 201 e guardada; a 2.ª espera', async () => {
      delete process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'];
      const id = await prescrever('Pantoprazol 20mg', '12/12h');
      const sem = await administrar(id);
      expect(sem.status).toBe(409);
      expect(sem.json.message).toMatch(/^VALIDACAO:.*justificacaoNaoValidada/);
      const com = await administrar(id, { justificacaoNaoValidada: 'dor epigástrica intensa, farmácia fechada' });
      expect(com.status).toBe(201);
      expect(com.json.avisos).toContain('Administrada antes da validação farmacêutica (1.ª dose urgente).');
      const reg = await ctx.bd.query('SELECT "justificacaoNaoValidada" FROM registos_medicacao WHERE id=$1', [com.json.id]);
      expect(reg.rows[0].justificacaoNaoValidada).toBe('dor epigástrica intensa, farmácia fechada');
      const segunda = await administrar(id, { justificacaoNaoValidada: 'outra vez urgente, mesmo motivo' });
      expect(segunda.status).toBe(409);
      expect(segunda.json.message).toMatch(/as seguintes esperam/);
    });

    it('bloquear: por validar não se administra; depois de validada, sim', async () => {
      process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'] = 'bloquear';
      const id = await prescrever('Esomeprazol 20mg');
      expect((await administrar(id, { justificacaoNaoValidada: 'urgente, mesmo assim por favor' })).status).toBe(409);
      expect((await far.pedido('PATCH', `/medicacao/${id}/validar`, {})).status).toBe(200);
      expect((await administrar(id)).status).toBe(201);
    });

    it('avisar: administra e devolve o aviso', async () => {
      process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'] = 'avisar';
      const id = await prescrever('Lansoprazol 30mg');
      const r = await administrar(id);
      expect(r.status).toBe(201);
      expect(r.json.avisos).toContain('Prescrição ainda não validada pela farmácia.');
    });

    it('rejeitada pela farmácia: nunca se administra, em nenhum modo', async () => {
      process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'] = 'avisar';
      const id = await prescrever('Ranitidina 150mg');
      expect((await far.pedido('PATCH', `/medicacao/${id}/rejeitar`, { motivoRejeicao: 'retirada do mercado (substituir)' })).status).toBe(200);
      const r = await administrar(id);
      expect(r.status).toBe(409);
      expect(r.json.message).toMatch(/rejeitou/);
    });
  });

  it('QA-09: administrações em simultâneo nunca dão 500 (201 ou 409)', async () => {
    process.env['VALIDACAO_ANTES_DE_ADMINISTRAR'] = 'avisar';
    const id = await prescrever('Paracetamol 1g', 'SOS');
    const rs = await Promise.all([1, 2, 3, 4].map(() => administrar(id, { justificacaoSOS: 'dor persistente, médico avisado' })));
    const estados = rs.map((r) => r.status);
    expect(estados.every((s) => s === 201 || s === 409)).toBe(true);
    expect(estados).toContain(201);
  });

  describe('QA-14 — descontinuar', () => {
    it('sem motivo → 400; com motivo grava autor e motivo, e o prescritor recebe tarefa', async () => {
      const id = await prescrever('Atorvastatina 20mg', '1x/dia');
      expect((await enf.pedido('PATCH', `/medicacao/${id}/descontinuar`, {})).status).toBe(400);
      const r = await enf.pedido('PATCH', `/medicacao/${id}/descontinuar`, { motivo: 'mialgias, suspende' });
      expect(r.status).toBe(200);
      const m = await ctx.bd.query('SELECT ativo, "descontinuadoPorId", "motivoDescontinuacao" FROM medicacoes WHERE id=$1', [id]);
      expect(m.rows[0]).toEqual({ ativo: false, descontinuadoPorId: await idDe(ctx, '00003'), motivoDescontinuacao: 'mialgias, suspende' });
      const t = await ctx.bd.query(`SELECT "responsavelId" FROM tarefas WHERE "doenteId"=$1 AND descricao LIKE 'Confirmar a descontinuação%'`, [d.doenteId]);
      expect(t.rows.map((x) => x.responsavelId)).toContain(await idDe(ctx, '00013'));
      expect((await enf.pedido('PATCH', `/medicacao/${id}/descontinuar`, { motivo: 'outra vez' })).status).toBe(409);
    });
  });

  describe('QA-16 — coerência dos sinais vitais', () => {
    const vital = (corpo: object) => enf.pedido('POST', `/sinais-vitais/${d.doenteId}`, corpo);
    it('registo vazio e PAD ≥ PAS → 400', async () => {
      expect((await vital({})).status).toBe(400);
      expect((await vital({ notas: 'só notas' })).status).toBe(400);
      expect((await vital({ pressaoSistolica: 40, pressaoDiastolica: 200 })).status).toBe(400);
    });
    it('valores incompatíveis com a vida: 422 sem confirmação, 201 com', async () => {
      const sem = await vital({ pulso: 0, frequenciaRespiratoria: 0 });
      expect(sem.status).toBe(422);
      expect(sem.json.errorCode).toBe('VALOR_CRITICO_POR_CONFIRMAR');
      expect((await vital({ pulso: 0, frequenciaRespiratoria: 0, confirmarValorCritico: true })).status).toBe(201);
    });
  });
});
