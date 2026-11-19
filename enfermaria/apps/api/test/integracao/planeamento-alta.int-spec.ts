import { arrancar, parar, entrar, idDe, criarDoenteInternado, Contexto, DoenteFixture } from './app-teste';
import { randomUUID } from 'crypto';

/**
 * PROD-13 — planeamento de alta e continuidade de cuidados, contra a BD real: sinalização pelo
 * Barthel, alta clínica (médico), referenciação RNCCI com estados, ensino com teach-back, e o
 * indicador de altas proteladas.
 */
describe('integração: planeamento de alta e continuidade de cuidados', () => {
  let ctx: Contexto;
  let d: DoenteFixture;

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003', '00013']);
    // O episódio do internamento (a fixture cria o doente por SQL) e um Barthel de dependência grave.
    await ctx.bd.query(
      `INSERT INTO episodios_internamento (id, "doenteId", numero, origem, estado, servico, "camaId") VALUES ($1, $2, 1, 'admissao', 'ativo', 'INTEGRACAO', $3)`,
      [randomUUID(), d.doenteId, d.camaId],
    );
    await ctx.bd.query(
      `INSERT INTO escalas_clinicas (id, "doenteId", "registadoPorId", tipo, valores, pontuacao) VALUES ($1, $2, $3, 'Barthel', '{}', 35)`,
      [randomUUID(), d.doenteId, await idDe(ctx, '00003')],
    );
  });
  afterAll(async () => { await parar(ctx); });

  it('jornada: sinalização, alta clínica, referenciação RNCCI, ensino e alta protelada', async () => {
    const enf = await entrar(ctx, '00003');
    let r = await enf.pedido('GET', `/planeamento-alta/doente/${d.doenteId}`);
    expect(r.status).toBe(200);
    expect(r.json.sinalizacao.map((s: any) => s.motivo)).toEqual(['dependencia', 'sem_avaliacao_inicial']);
    expect(r.json).toMatchObject({ internado: true, altaClinicaEm: null, diasAposAltaClinica: null });

    // Referenciação para convalescença: proposta → enviada → aceite.
    const ref = await enf.pedido('POST', `/planeamento-alta/doente/${d.doenteId}/referenciacoes`, { destino: 'rncci_convalescenca', motivo: 'Barthel 35, vive só, precisa de reabilitação' });
    expect(ref.status).toBe(201);
    expect(ref.json.estado).toBe('proposta');
    expect((await enf.pedido('PATCH', `/planeamento-alta/referenciacoes/${ref.json.id}`, { estado: 'aceite' })).status).toBe(400);
    expect((await enf.pedido('PATCH', `/planeamento-alta/referenciacoes/${ref.json.id}`, { estado: 'enviada' })).json.estado).toBe('enviada');

    // Só o médico marca a alta clínica.
    expect((await enf.pedido('PUT', `/planeamento-alta/doente/${d.doenteId}/alta-clinica`, { altaClinica: true })).status).toBe(403);
    const med = await entrar(ctx, '00013');
    expect((await med.pedido('PUT', `/planeamento-alta/doente/${d.doenteId}/alta-clinica`, { altaClinica: true })).status).toBe(200);

    // Ensino ao cuidador, não compreendido → sinalizado até ser repetido.
    expect((await enf.pedido('POST', `/planeamento-alta/doente/${d.doenteId}/ensinos`, { tema: 'transferencias', destinatario: 'cuidador', compreensao: 'parcial' })).status).toBe(400);
    const en = await enf.pedido('POST', `/planeamento-alta/doente/${d.doenteId}/ensinos`, {
      tema: 'transferencias', destinatario: 'cuidador', cuidadorNome: 'Filho — Rui', compreensao: 'parcial', nota: 'Repetir a transferência cama–cadeira amanhã',
    });
    expect(en.status).toBe(201);
    r = await enf.pedido('GET', `/planeamento-alta/doente/${d.doenteId}`);
    expect(r.json.sinalizacao.map((s: any) => s.motivo)).toContain('ensino_nao_compreendido');
    expect(r.json.diasAposAltaClinica).toBe(0);

    // A alta clínica foi há 3 dias: aparece nas altas proteladas, à espera da RNCCI.
    await ctx.bd.query(`UPDATE planos_alta SET "altaClinicaEm" = now() - interval '3 days 1 hour' WHERE "doenteId" = $1`, [d.doenteId]);
    const chefe = await entrar(ctx, '00015');
    const ap = await chefe.pedido('GET', '/planeamento-alta/altas-proteladas?servico=INTEGRACAO');
    expect(ap.status).toBe(200);
    const linha = ap.json.linhas.find((l: any) => l.doenteId === d.doenteId);
    expect(linha).toMatchObject({ dias: 3, aguarda: [{ destino: 'rncci_convalescenca', estado: 'enviada' }] });

    // Um auxiliar não regista ensinos.
    const aux = await entrar(ctx, '00004');
    expect((await aux.pedido('POST', `/planeamento-alta/doente/${d.doenteId}/ensinos`, { tema: 'quedas', destinatario: 'doente', compreensao: 'compreendeu' })).status).toBe(403);
  });
});
