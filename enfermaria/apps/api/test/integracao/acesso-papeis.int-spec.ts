import { arrancar, parar, entrar, criarDoenteInternado, Contexto, DoenteFixture } from './app-teste';

/**
 * QA-11 — matriz papel × recurso contra a BD real: a TI não lê dados de doentes sem break-glass;
 * o administrativo vê a identificação e o internamento (e gere contactos), mas não o processo
 * clínico; o farmacêutico continua a ver a medicação de qualquer internado; e a lista de eventos
 * adversos é só da gestão de risco.
 */
describe('integração: acesso por papel aos dados do doente (QA-11)', () => {
  let ctx: Contexto;
  let d: DoenteFixture;

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003']);
  });
  afterAll(async () => { await parar(ctx); });

  it('TI: dados clínicos e administrativos do doente → 403 (sem break-glass)', async () => {
    const ti = await entrar(ctx, '00009');
    for (const rota of [`/alergias/${d.doenteId}`, `/medicacao/doente/${d.doenteId}`, `/sinais-vitais/${d.doenteId}`, `/contactos/${d.doenteId}`, `/doentes/${d.doenteId}`]) {
      expect([rota, (await ti.pedido('GET', rota)).status]).toEqual([rota, 403]);
    }
    expect((await ti.pedido('POST', `/contactos/${d.doenteId}`, { nome: 'X', telefone: '910000000', relacao: 'filho' })).status).toBe(403);
  });

  it('administrativo: identificação e internamento sim, processo clínico não', async () => {
    const adm = await entrar(ctx, '00007');
    const r = await adm.pedido('GET', `/doentes/${d.doenteId}`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ id: d.doenteId, numeroProcesso: expect.any(String), cama: { id: d.camaId } });
    for (const clinico of ['medicacoes', 'notasTurno', 'tarefas', 'atribuicoes']) expect(r.json[clinico]).toBeUndefined();

    for (const rota of [`/alergias/${d.doenteId}`, `/medicacao/doente/${d.doenteId}`, `/sinais-vitais/${d.doenteId}`]) {
      expect([rota, (await adm.pedido('GET', rota)).status]).toEqual([rota, 403]);
    }
    expect((await adm.pedido('GET', `/contactos/${d.doenteId}`)).status).toBe(200);
    expect((await adm.pedido('POST', `/contactos/${d.doenteId}`, { nome: 'Filha', telefone: '910000001', relacao: 'filha' })).status).toBe(201);
  });

  it('farmacêutico: a medicação de qualquer internado (validação farmacêutica)', async () => {
    const far = await entrar(ctx, '00006');
    expect((await far.pedido('GET', `/medicacao/doente/${d.doenteId}`)).status).toBe(200);
  });

  it('eventos adversos: todos notificam; só a gestão de risco vê a lista', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('POST', '/eventos-adversos', { tipo: 'queda', gravidade: 'sem_dano', descricao: 'Queda sem dano', doenteId: d.doenteId })).status).toBe(201);
    expect((await enf.pedido('GET', '/eventos-adversos')).status).toBe(403);
    const chefe = await entrar(ctx, '00015');
    expect((await chefe.pedido('GET', '/eventos-adversos')).status).toBe(200);
  });
});
