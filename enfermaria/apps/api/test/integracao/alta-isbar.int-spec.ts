import { randomUUID } from 'node:crypto';
import { arrancar, parar, entrar, idDe, Contexto } from './app-teste';

/**
 * PROD-12 — alta única com requisitos (reconciliação + nota de enfermagem) e encerramento do
 * internamento; UX-22 — passagem de turno ISBAR entregue e recebida, contra a BD real.
 */
describe('integração: alta estruturada única e passagem de turno ISBAR', () => {
  let ctx: Contexto;
  const sufixo = randomUUID().slice(0, 6);

  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  /** Admite pela API (abre o episódio) e atribui à equipa no turno em curso. */
  async function internar(chave: string, equipa: string[]) {
    const camaId = randomUUID();
    await ctx.bd.query(`INSERT INTO camas (id, numero, quarto, estado, servico) VALUES ($1, $2, 'AI', 'livre', $3)`, [camaId, `AI-${sufixo}-${chave}`, `ALTA-${sufixo}`]);
    const adm = await entrar(ctx, '00007');
    const r = await adm.pedido('POST', '/doentes/admitir', { nome: `Doente ${chave} ${sufixo}`, dataNascimento: '1950-01-01', diagnosticoPrincipal: 'Pneumonia', camaId });
    expect(r.status).toBe(201);
    const turnoId = randomUUID();
    await ctx.bd.query(`INSERT INTO turnos (id, tipo, "dataInicio", "dataFim", "chefeTurnoId") VALUES ($1, 'manha', now() - interval '1 hour', now() + interval '8 hours', $2)`,
      [turnoId, await idDe(ctx, '00015')]);
    for (const n of equipa) {
      await ctx.bd.query(`INSERT INTO atribuicoes_doente (id, "doenteId", "enfermeiroId", "turnoId") VALUES ($1, $2, $3, $4)`, [randomUUID(), r.json.id, await idDe(ctx, n), turnoId]);
    }
    return r.json.id as string;
  }

  it('alta: recusa sem reconciliação nem nota de enfermagem; completa encerra o internamento', async () => {
    const doenteId = await internar('alta', ['00003', '00013']);
    const med = await entrar(ctx, '00013');
    expect((await med.pedido('POST', `/alergias/${doenteId}/avaliacao`, { estado: 'sem_alergias_conhecidas' })).status).toBe(201);
    const p = await med.pedido('POST', '/medicacao/prescrever', { doenteId, nome: 'Omeprazol 20mg', dose: '20 mg', via: 'oral', frequencia: '1x/dia' });
    expect(p.status).toBe(201);

    const req = await med.pedido('GET', `/doentes/${doenteId}/alta/requisitos`);
    expect(req.json).toMatchObject({ exigidos: ['reconciliacao', 'nota_enfermagem'], notaEnfermagem: null });
    expect(req.json.prescricoesAtivas.map((x: any) => x.id)).toEqual([p.json.id]);

    const base = { motivoAlta: 'melhoria', destino: 'domicilio', resumoClinical: 'Evolução favorável, apirético há 48 h' };
    const incompleta = await med.pedido('POST', `/doentes/${doenteId}/alta-estruturada`, base);
    expect(incompleta.status).toBe(409);
    expect(incompleta.json).toMatchObject({ errorCode: 'ALTA_INCOMPLETA' });
    expect(incompleta.json.contexto.emFalta).toHaveLength(2);

    const enf = await entrar(ctx, '00003');
    const sug = await enf.pedido('GET', `/doentes/${doenteId}/nota-alta-enfermagem`);
    expect(sug.json).toMatchObject({ nota: null, sugestao: expect.objectContaining({ observacoes: expect.any(String) }) });
    const nota = await enf.pedido('PUT', `/doentes/${doenteId}/nota-alta-enfermagem`, {
      autonomia: 'Autónomo nas AVD', ensinos: 'Toma do omeprazol em jejum', referenciacao: 'csp',
    });
    expect(nota.status).toBe(200);

    const alta = await med.pedido('POST', `/doentes/${doenteId}/alta-estruturada`, {
      ...base,
      reconciliacao: [
        { medicacaoId: p.json.id, decisao: 'manter' },
        { decisao: 'nova', nome: 'Paracetamol', dose: '1 g', via: 'oral', frequencia: 'SOS' },
      ],
    });
    expect(alta.status).toBe(201);
    expect(alta.json.prescricaoSaida).toBe('Omeprazol 20mg 20 mg oral 1x/dia\n[NOVO] Paracetamol 1 g oral SOS');

    const estado = await ctx.bd.query(
      `SELECT (SELECT count(*)::int FROM medicacoes WHERE "doenteId" = $1 AND ativo) AS ativas,
              (SELECT estado FROM episodios_internamento WHERE "doenteId" = $1) AS episodio,
              (SELECT count(*)::int FROM atribuicoes_doente WHERE "doenteId" = $1) AS atribuicoes,
              (SELECT count(*)::int FROM reconciliacao_alta_linhas WHERE "doenteId" = $1) AS linhas`, [doenteId]);
    expect(estado.rows[0]).toEqual({ ativas: 0, episodio: 'alta', atribuicoes: 0, linhas: 2 });

    // Follow-ups: para o médico que deu a alta (antes: o primeiro médico criado no hospital).
    await new Promise((r) => setTimeout(r, 300));
    const fu = await ctx.bd.query(`SELECT DISTINCT "responsavelId" FROM followup_agendados WHERE "doenteId" = $1`, [doenteId]);
    expect(fu.rows).toEqual([{ responsavelId: await idDe(ctx, '00013') }]);

    // A via antiga, sem sumário, deixou de existir.
    expect((await (await entrar(ctx, '00007')).pedido('PATCH', `/doentes/${doenteId}/alta`, {})).status).toBe(404);
  });

  it('passagem ISBAR: pré-preenchida, entregue por quem sai, recebida por quem entra (e fixa depois)', async () => {
    const doenteId = await internar('isbar', ['00003', '00014']);
    const sai = await entrar(ctx, '00003');
    const sug = await sai.pedido('GET', `/passagem-isbar/doente/${doenteId}/sugestao`);
    expect(sug.status).toBe(200);
    expect(sug.json.identificacao).toMatch(/processo/);
    expect(sug.json.identificacao).toMatch(/Alergias: NÃO AVALIADAS/);

    const entregue = await sai.pedido('PUT', `/passagem-isbar/doente/${doenteId}`, { ...sug.json, entregar: true });
    expect(entregue.status).toBe(200);
    expect(entregue.json).toMatchObject({ estado: 'entregue', servico: `ALTA-${sufixo}` });

    const lista = await sai.pedido('GET', '/passagem-isbar');
    expect(lista.json.doentes.find((x: any) => x.doente.id === doenteId)?.passagem).toMatchObject({ estado: 'entregue' });

    expect((await sai.pedido('POST', `/passagem-isbar/${entregue.json.id}/receber`, {})).status).toBe(400);
    const entra = await entrar(ctx, '00014');
    const recebida = await entra.pedido('POST', `/passagem-isbar/${entregue.json.id}/receber`, {});
    expect(recebida.status).toBe(201);
    expect(recebida.json).toMatchObject({ estado: 'recebida', recebidaEm: expect.any(String) });
    expect((await sai.pedido('PUT', `/passagem-isbar/doente/${doenteId}`, { ...sug.json, situacao: 'alterado' })).status).toBe(409);

    // Quem não tem o doente não lê a sugestão (acesso ao doente verificado).
    expect((await (await entrar(ctx, '00012')).pedido('GET', `/passagem-isbar/doente/${doenteId}/sugestao`)).status).toBe(403);
  });
});
