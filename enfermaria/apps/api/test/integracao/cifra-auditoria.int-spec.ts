import { arrancar, parar, entrar, criarDoenteInternado, idDe, Contexto, DoenteFixture } from './app-teste';

/**
 * QA-20 (b, c, d) — cifragem de PII e trilho de auditoria vistos na BASE DE DADOS, não em
 * mocks. Foi assim que ARQ-01/QA-03 (contactos em claro) e ARQ-02 (escritas sem autor)
 * passaram despercebidos à suite unitária.
 */
describe('integração: cifragem e auditoria', () => {
  let ctx: Contexto;
  let d: DoenteFixture;
  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003', '00011']);
  });
  afterAll(async () => { await parar(ctx); });

  it('admitir pela API grava o nome cifrado; a API devolve-o decifrado', async () => {
    const adm = await entrar(ctx, '00007');
    const r = await adm.pedido('POST', '/doentes/admitir', {
      nome: 'Maria Integração Cifrada', dataNascimento: '1961-02-03', diagnosticoPrincipal: 'Observação',
    });
    expect(r.status).toBe(201);
    const bruto = await ctx.bd.query('SELECT nome FROM doentes WHERE id=$1', [r.json.id]);
    expect(bruto.rows[0].nome).toMatch(/^enc:/);
    expect(bruto.rows[0].nome).not.toContain('Maria');
    const lido = await adm.pedido('GET', `/doentes/${r.json.id}`);
    expect(lido.json.nome).toBe('Maria Integração Cifrada');
  });

  it('contacto de emergência: nome e telefone cifrados na BD, legíveis na API (ARQ-01/QA-03)', async () => {
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('POST', `/contactos/${d.doenteId}`, { nome: 'João Contacto', relacao: 'filho', telefone: '912345678' });
    expect(r.status).toBe(201);
    const bruto = await ctx.bd.query('SELECT nome, telefone FROM contactos_emergencia WHERE id=$1', [r.json.id]);
    expect(bruto.rows[0].nome).toMatch(/^enc:/);
    expect(bruto.rows[0].telefone).toMatch(/^enc:/);
    const lista = await enf.pedido('GET', `/contactos/${d.doenteId}`);
    expect(lista.json.map((c: any) => c.telefone)).toContain('912345678');
  });

  it('nenhuma resposta clínica devolve PII por decifrar (relações aninhadas, QA-04)', async () => {
    const med = await entrar(ctx, '00011');
    expect((await med.pedido('POST', `/alergias/${d.doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' })).status).toBe(201);
    await med.pedido('POST', '/medicacao/prescrever', { doenteId: d.doenteId, nome: 'Amoxicilina 500mg', dose: '500 mg', via: 'oral', frequencia: '3x/dia' });
    const far = await entrar(ctx, '00006');
    for (const [s, rota] of [[med, `/medicacao/doente/${d.doenteId}`], [far, '/medicacao/pendentes-validacao'], [med, `/doentes/${d.doenteId}`]] as const) {
      const r = await s.pedido('GET', rota);
      expect([rota, r.status]).toEqual([rota, 200]);
      expect([rota, JSON.stringify(r.json).includes('enc:')]).toEqual([rota, false]);
    }
  });

  it('uma escrita clínica fica auditada com o autor e o id de correlação do pedido (ARQ-02/SEC-07)', async () => {
    const enf = await entrar(ctx, '00003');
    const r = await enf.pedido('POST', `/sinais-vitais/${d.doenteId}`,
      { pulso: 88, saturacaoO2: 96, temperatura: 37.2, pressaoSistolica: 125, pressaoDiastolica: 80, frequenciaRespiratoria: 16 },
      { 'X-Correlation-Id': 'int-auditoria-sv-1' });
    expect(r.status).toBe(201);
    const a = await ctx.bd.query(
      `SELECT "utilizadorId", "utilizadorRole", acao, "correlationId" FROM audit_logs WHERE "entidadeId"=$1 ORDER BY seq DESC LIMIT 1`, [r.json.id],
    );
    expect(a.rows[0]).toMatchObject({ utilizadorId: await idDe(ctx, '00003'), correlationId: 'int-auditoria-sv-1' });
  });

  it('remover é soft-delete com autor (alergia: motivo obrigatório), e o trilho de auditoria não se apaga', async () => {
    const enf = await entrar(ctx, '00003');
    const c = await enf.pedido('POST', `/contactos/${d.doenteId}`, { nome: 'Para remover', relacao: 'vizinho', telefone: '913000000' });
    expect((await enf.pedido('DELETE', `/contactos/${c.json.id}`)).status).toBe(200);
    const linha = await ctx.bd.query('SELECT "deletedAt", "removidoPorId" FROM contactos_emergencia WHERE id=$1', [c.json.id]);
    expect(linha.rows[0].deletedAt).not.toBeNull();
    expect(linha.rows[0].removidoPorId).toBe(await idDe(ctx, '00003'));
    expect((await enf.pedido('GET', `/contactos/${d.doenteId}`)).json.map((x: any) => x.id)).not.toContain(c.json.id);

    const med = await entrar(ctx, '00011');
    const al = await med.pedido('POST', `/alergias/${d.doenteId}`, { alergenio: 'Látex', tipo: 'latex', severidade: 'moderada' });
    expect((await med.pedido('DELETE', `/alergias/${al.json.id}`, {})).status).toBe(400); // QA-02: sem motivo, não
    expect((await med.pedido('DELETE', `/alergias/${al.json.id}`, { motivo: 'Registada no doente errado por engano' })).status).toBe(200);
    const alergia = await ctx.bd.query('SELECT "deletedAt", "motivoRemocao" FROM alergias WHERE id=$1', [al.json.id]);
    expect(alergia.rows[0]).toMatchObject({ motivoRemocao: 'Registada no doente errado por engano' });
    expect(alergia.rows[0].deletedAt).not.toBeNull();
    // O trilho de auditoria é append-only: nem o dono da BD o altera.
    await expect(ctx.bd.query('DELETE FROM audit_logs WHERE seq = (SELECT max(seq) FROM audit_logs)')).rejects.toThrow();
  });
});
