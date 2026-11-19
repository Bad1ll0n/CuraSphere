import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, criarDoenteInternado, Contexto } from './app-teste';

/**
 * PROD-14 — interoperabilidade contra a BD real: ADT de entrada com efeito (A01 cria, A08 atualiza,
 * A03 concilia/avisa), fila de saída por pull, exportação FHIR R4 e RNU sem dados fictícios.
 */
describe('integração: interoperabilidade (HL7, FHIR, RNU)', () => {
  let ctx: Contexto;
  const TOKEN = 'token-hl7-de-integracao';
  const hisId = `HIS${Date.now()}`;

  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  const hl7 = async (linhas: string[], token = TOKEN) => {
    const r = await fetch(`${ctx.url}/hl7/receive`, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'x-hl7-token': token }, body: linhas.join('\r') });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };
  const msh = (tipo: string, ctl: string) => `MSH|^~\\&|SONHO|HOSP|CURASPHERE|HOSP|20261119083000||${tipo}|${ctl}|P|2.5`;
  const pid = (nome = 'Teixeira^Rosa') => `PID|1||${hisId}^^^HIS^PI~123456789^^^SNS^NH||${nome}||19420311|F`;

  it('token errado → 401', async () => {
    expect((await hl7([msh('ADT^A01', 'X'), pid()], 'errado')).status).toBe(401);
  });

  it('A01 regista o doente pendente de cama; A08 atualiza; A03 com o doente fora de internamento concilia', async () => {
    const a01 = await hl7([msh('ADT^A01^ADT_A01', 'C1'), pid(), 'PV1|1|I|MED^4^4B']);
    expect(a01.status).toBe(201);
    expect(a01.json).toMatchObject({ processado: true, efeito: expect.stringMatching(/pendente de cama/) });
    expect(a01.json.ack).toMatch(/MSA\|AA\|C1/);
    const d = await ctx.bd.query(`SELECT d.id, d.sexo, d."estadoRegisto", f."numeroSNS" FROM doentes d LEFT JOIN fichas_pessoais_doente f ON f."doenteId" = d.id WHERE d."identificadorHis" = $1`, [hisId]);
    expect(d.rows[0]).toMatchObject({ sexo: 'feminino', estadoRegisto: 'pendente_cama', numeroSNS: '123456789' });

    // Repetir o A01 não duplica — emparelha pelo identificador do HIS.
    expect((await hl7([msh('ADT^A01', 'C2'), pid()])).json.doenteId).toBe(d.rows[0].id);
    expect((await ctx.bd.query(`SELECT count(*)::int AS n FROM doentes WHERE "identificadorHis" = $1`, [hisId])).rows[0].n).toBe(1);

    const a08 = await hl7([msh('ADT^A08', 'C3'), pid('Teixeira^Rosa^Maria')]);
    expect(a08.json).toMatchObject({ processado: true, doenteId: d.rows[0].id });

    const a03 = await hl7([msh('ADT^A03', 'C4'), pid()]);
    expect(a03.json.efeito).toMatch(/conciliada/);

    // Um doente que o CuraSphere não conhece, num A08: AE, sem criar nada.
    const desconhecido = await hl7([msh('ADT^A08', 'C5'), 'PID|1||NAOEXISTE^^^HIS^PI||X^Y']);
    expect(desconhecido.json).toMatchObject({ processado: false });
    expect(desconhecido.json.ack).toMatch(/MSA\|AE\|C5/);

    // Tipo não suportado: AR, registado como não processado.
    const siu = await hl7([msh('SIU^S12', 'C6')]);
    expect(siu.json.ack).toMatch(/MSA\|AR\|C6/);
    const reg = await ctx.bd.query(`SELECT processado, efeito, "doenteId" FROM hl7_mensagens WHERE "conteudoRaw" LIKE '%|C1|%'`);
    expect(reg.rows[0]).toMatchObject({ processado: true, doenteId: d.rows[0].id });
  });

  it('A03 com o doente ainda internado no CuraSphere: alerta à equipa, sem dar alta', async () => {
    const f = await criarDoenteInternado(ctx);
    const outroHis = `HIS-I-${Date.now()}`;
    await ctx.bd.query(`UPDATE doentes SET "identificadorHis" = $1 WHERE id = $2`, [outroHis, f.doenteId]);
    await ctx.bd.query(`INSERT INTO episodios_internamento (id, "doenteId", numero, origem, estado, servico) VALUES ($1, $2, 1, 'admissao', 'ativo', 'MED')`, [randomUUID(), f.doenteId]);
    const r = await hl7([msh('ADT^A03', 'D1'), `PID|1||${outroHis}^^^HIS^PI||X^Y`]);
    expect(r.json.efeito).toMatch(/equipa avisada/);
    const al = await ctx.bd.query(`SELECT count(*)::int AS n FROM alertas_clinicos WHERE "doenteId" = $1 AND tipo = 'adt_alta_sem_alta_clinica'`, [f.doenteId]);
    expect(al.rows[0].n).toBe(1);
    expect((await ctx.bd.query(`SELECT "estadoRegisto" FROM doentes WHERE id = $1`, [f.doenteId])).rows[0].estadoRegisto).toBe('internado');
  });

  it('fila de saída por pull: recolher e confirmar a entrega', async () => {
    const id = randomUUID();
    await ctx.bd.query(`INSERT INTO hl7_mensagens (id, tipo, remetente, "conteudoRaw", processado, direcao) VALUES ($1, 'ADT^A01', 'CURASPHERE', 'MSH|^~\\&|CURASPHERE', false, 'saida')`, [id]);
    const sem = await fetch(`${ctx.url}/hl7/saida`);
    expect(sem.status).toBe(401);
    const fila: any = await (await fetch(`${ctx.url}/hl7/saida`, { headers: { 'x-hl7-token': TOKEN } })).json();
    expect(fila.map((m: any) => m.id)).toContain(id);
    const ok = await fetch(`${ctx.url}/hl7/saida/${id}/entregue`, { method: 'POST', headers: { 'x-hl7-token': TOKEN, 'Content-Type': 'application/json' }, body: '{}' });
    expect(await ok.json()).toEqual({ atualizada: true });
    const depois: any = await (await fetch(`${ctx.url}/hl7/saida`, { headers: { 'x-hl7-token': TOKEN } })).json();
    expect(depois.map((m: any) => m.id)).not.toContain(id);
  });

  it('exportação FHIR: Bundle document R4 com Composition; RNU responde "não configurado"', async () => {
    const f = await criarDoenteInternado(ctx, ['00013']);
    const med = await entrar(ctx, '00013');
    const b = await med.pedido('GET', `/fhir/doentes/${f.doenteId}/exportar-fhir`);
    expect(b.status).toBe(200);
    expect(b.json).toMatchObject({ resourceType: 'Bundle', type: 'document', identifier: expect.any(Object) });
    expect(b.json.entry[0].resource.resourceType).toBe('Composition');
    expect(b.json.entry.find((e: any) => e.resource.resourceType === 'Patient').resource.gender).toBeDefined();

    const rnu = await med.pedido('GET', '/fhir/doentes/lookup-sns?numeroSNS=123456789');
    expect(rnu.json).toMatchObject({ encontrado: false, fonte: 'nao_configurado', dadosPreenchidos: null });
    expect((await med.pedido('GET', '/fhir/doentes/lookup-sns?numeroSNS=12')).status).toBe(400);
  });
});
