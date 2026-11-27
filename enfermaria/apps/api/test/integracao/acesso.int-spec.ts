import { arrancar, parar, entrar, criarDoenteInternado, idDe, Contexto, DoenteFixture } from './app-teste';

/**
 * QA-20 (a) — matriz papel × rota clínica, na app real. Os bugs QA-01/02/10/12 viviam no
 * interceptor global e nos guards, onde nenhum teste unitário chegava.
 */
const ROTAS_LEITURA = (id: string) => [
  `/doentes/${id}`,
  `/alergias/${id}`,
  `/sinais-vitais/${id}`,
  `/contactos/${id}`,
  `/medicacao/doente/${id}`,
];

describe('integração: acesso ao doente', () => {
  let ctx: Contexto;
  let atribuido: DoenteFixture;   // atribuído ao enfermeiro 00003
  let alheio: DoenteFixture;      // sem atribuições

  beforeAll(async () => {
    ctx = await arrancar();
    atribuido = await criarDoenteInternado(ctx, ['00003']);
    alheio = await criarDoenteInternado(ctx);
  });
  afterAll(async () => { await parar(ctx); });

  it('enfermeiro atribuído lê todo o processo do SEU doente', async () => {
    const enf = await entrar(ctx, '00003');
    for (const rota of ROTAS_LEITURA(atribuido.doenteId)) {
      expect([rota, (await enf.pedido('GET', rota)).status]).toEqual([rota, 200]);
    }
  });

  it('o mesmo enfermeiro NÃO lê nenhuma rota de um doente que não é seu (403 BREAK_GLASS_REQUIRED)', async () => {
    const enf = await entrar(ctx, '00003');
    for (const rota of ROTAS_LEITURA(alheio.doenteId)) {
      expect([rota, (await enf.pedido('GET', rota)).status]).toEqual([rota, 403]);
    }
    expect((await enf.pedido('GET', `/doentes/${alheio.doenteId}`)).json?.errorCode).toBe('BREAK_GLASS_REQUIRED');
  });

  it('escritas clínicas num doente alheio também são recusadas (QA-01/02/10/12)', async () => {
    const enf = await entrar(ctx, '00003');
    const med = await entrar(ctx, '00011');
    const id = alheio.doenteId;
    expect((await enf.pedido('POST', `/sinais-vitais/${id}`, { pulso: 80 })).status).toBe(403);
    expect((await enf.pedido('POST', `/contactos/${id}`, { nome: 'X', relacao: 'filho', telefone: '910000000' })).status).toBe(403);
    expect((await med.pedido('POST', `/alergias/${id}`, { alergenio: 'Penicilina', tipo: 'medicamento', severidade: 'grave' })).status).toBe(403);
    expect((await med.pedido('POST', '/medicacao/prescrever', { doenteId: id, nome: 'Paracetamol', dose: '1 g', via: 'oral', frequencia: '8/8h' })).status).toBe(403);
    expect((await enf.pedido('POST', '/portal/criar-acesso', { doenteId: id, email: 'x@exemplo.pt', senha: 'SenhaDeTeste12345' })).status).toBe(403);
  });

  it('break-glass com justificação dá acesso, fica registado, e a leitura é auditada', async () => {
    const med = await entrar(ctx, '00012');
    const id = alheio.doenteId;
    expect((await med.pedido('GET', `/doentes/${id}`)).status).toBe(403);
    const bg = await med.pedido('POST', '/break-glass', { doenteId: id, motivo: 'Emergência: doente instável, médico de serviço sem atribuição' });
    expect(bg.status).toBe(201);
    expect((await med.pedido('GET', `/doentes/${id}`)).status).toBe(200);

    const medId = await idDe(ctx, '00012');
    const bgs = await ctx.bd.query('SELECT count(*)::int n FROM break_glass_access WHERE "utilizadorId"=$1 AND "doenteId"=$2', [medId, id]);
    expect(bgs.rows[0].n).toBe(1);
    // SEC-09: a direção vê quem leu o processo — incluindo a tentativa recusada antes do break-glass.
    const dir = await entrar(ctx, '00001');
    const acessos = await dir.pedido('GET', `/doentes/${id}/acessos`);
    expect(acessos.status).toBe(200);
    const doMedico = acessos.json.registos.filter((a: any) => a.utilizadorId === medId);
    expect(doMedico.map((a: any) => a.resultado)).toEqual(expect.arrayContaining(['negado', 'concedido']));
  });

  it('um papel sem acesso clínico (operacional) não lê o processo nem com o doente atribuído a outrem', async () => {
    const ope = await entrar(ctx, '00008');
    for (const rota of [`/alergias/${atribuido.doenteId}`, `/medicacao/doente/${atribuido.doenteId}`]) {
      expect([rota, (await ope.pedido('GET', rota)).status]).toEqual([rota, 403]);
    }
  });
});
