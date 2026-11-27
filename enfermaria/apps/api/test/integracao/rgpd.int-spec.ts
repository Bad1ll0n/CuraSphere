import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, criarDoenteInternado, idDe, Sessao, Contexto, DoenteFixture } from './app-teste';

/**
 * SEC-20 — direitos do titular contra a BD real: a exportação leva todas as tabelas do titular
 * (sem segredos nem PII por decifrar), o DPO responde a um pedido feito ao balcão, e um processo
 * fora do prazo de retenção é anonimizado na identificação — o conteúdo clínico fica.
 */
describe('integração: direitos do titular (SEC-20)', () => {
  let ctx: Contexto;
  let d: DoenteFixture;
  const email = `rgpd-${randomUUID().slice(0, 6)}@teste.local`;

  beforeAll(async () => {
    ctx = await arrancar();
    d = await criarDoenteInternado(ctx, ['00003']);
  });
  afterAll(async () => { await parar(ctx); });

  it('portal: a exportação traz todas as tabelas do titular e quem consultou o processo, sem segredos', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('POST', `/sinais-vitais/${d.doenteId}`, { pulso: 80, saturacaoO2: 97, temperatura: 36.8, pressaoSistolica: 120, pressaoDiastolica: 75, frequenciaRespiratoria: 15 })).status).toBe(201);
    expect((await enf.pedido('POST', `/contactos/${d.doenteId}`, { nome: 'Filho do Titular', relacao: 'filho', telefone: '916000111' })).status).toBe(201);
    expect((await enf.pedido('GET', `/doentes/${d.doenteId}`)).status).toBe(200); // fica uma leitura no trilho
    expect((await enf.pedido('POST', `/consentimentos-tratamento/doente/${d.doenteId}`, { finalidade: 'portal_doente', decisao: 'consentimento' })).status).toBe(201);
    expect((await enf.pedido('POST', '/portal/criar-acesso', { doenteId: d.doenteId, email, senha: 'PortalRgpd12345!' })).status).toBe(201);

    const portal = new Sessao(ctx.url);
    expect((await portal.pedido('POST', '/portal/login', { email, senha: 'PortalRgpd12345!' })).status).toBeLessThan(300);
    const r = await portal.pedido('GET', '/portal/exportar/json');
    expect(r.status).toBe(200);
    expect(r.json.titular.id).toBe(d.doenteId);
    expect(Object.keys(r.json.dados)).toEqual(expect.arrayContaining(['SinalVital', 'ContactoEmergencia', 'AtribuicaoDoente']));
    expect(r.json.dados.ContactoEmergencia[0].telefone).toBe('916000111'); // decifrado
    const texto = JSON.stringify(r.json);
    expect(texto).not.toContain('enc:');
    expect(texto).not.toMatch(/passwordHash|accessTokenHash|nomeBusca/);
    expect(r.json.dados).not.toHaveProperty('PortalDoente');
    // Quem consultou o processo (art.º 15.º) — o trilho de leituras é escrito em lote, por isso
    // aqui só se verifica que vai na exportação, no formato do titular (sem IP nem rota).
    expect(Array.isArray(r.json.acessos.registos)).toBe(true);
    expect(JSON.stringify(r.json.acessos)).not.toMatch(/"ip"|"rota"/);
  });

  it('o DPO (qualidade) exporta para um pedido feito ao balcão; um clínico não', async () => {
    expect((await (await entrar(ctx, '00010')).pedido('GET', `/rgpd/titular/${d.doenteId}/exportacao`)).status).toBe(200);
    expect((await (await entrar(ctx, '00003')).pedido('GET', `/rgpd/titular/${d.doenteId}/exportacao`)).status).toBe(403);
  });

  it('fora do prazo de retenção: anonimiza a identificação e mantém o conteúdo clínico; dentro do prazo, recusa', async () => {
    const dpo = await entrar(ctx, '00010');
    // Dentro do prazo (o doente da fixture está internado): recusado.
    expect((await dpo.pedido('POST', `/rgpd/titular/${d.doenteId}/anonimizar`, { motivo: 'Teste de recusa dentro do prazo' })).status).toBe(400);

    const antigo = randomUUID();
    await ctx.bd.query(
      `INSERT INTO doentes (id, nome, "numeroProcesso", "dataNascimento", "diagnosticoPrincipal", "estadoRegisto", "dataAdmissao", "dataAlta", ativo, "administrativoAdmissaoId")
       VALUES ($1, 'Antigo Titular', $2, '1931-07-09', 'Pneumonia', 'ambulatorio', '1999-01-01', '2000-01-10', false, $3)`,
      [antigo, `OLD-${antigo.slice(0, 8)}`, await idDe(ctx, '00007')],
    );
    await ctx.bd.query(`INSERT INTO fichas_pessoais_doente (id, "doenteId", nif, telefone, morada, "atualizadoEm") VALUES ($1, $2, '123456780', '910000000', 'Rua Velha 1', now())`, [randomUUID(), antigo]);

    const ret = await dpo.pedido('GET', '/rgpd/retencao');
    expect(ret.json.politica.anosProcessoClinico).toBe(20);
    expect(ret.json.elegiveis.map((e: any) => e.id)).toContain(antigo);

    expect((await dpo.pedido('POST', `/rgpd/titular/${antigo}/anonimizar`, { motivo: 'Fim do prazo de retenção do processo' })).status).toBe(201);
    const linha = (await ctx.bd.query(`SELECT d."numeroProcesso", d."dataNascimento", d."diagnosticoPrincipal", d."anonimizadoEm", f.nif, f.telefone, f.morada
      FROM doentes d LEFT JOIN fichas_pessoais_doente f ON f."doenteId" = d.id WHERE d.id = $1`, [antigo])).rows[0];
    expect(linha.numeroProcesso).toBe(`ANON-${antigo.slice(0, 8)}`);
    expect(new Date(linha.dataNascimento).toISOString().slice(0, 10)).toBe('1931-01-01');
    expect(linha.diagnosticoPrincipal).toBe('Pneumonia'); // o conteúdo clínico fica
    expect(linha.anonimizadoEm).not.toBeNull();
    expect([linha.nif, linha.telefone, linha.morada]).toEqual([null, null, null]);
    const lido = await dpo.pedido('GET', `/doentes/${antigo}`);
    expect(lido.json.nome).toBe('Titular anonimizado');
    // A auditoria deste evento vai pela fila (escrita em lote): espera-se pela drenagem.
    let auditado = 0;
    for (let i = 0; i < 40 && auditado === 0; i++) {
      auditado = (await ctx.bd.query(`SELECT 1 FROM audit_logs WHERE acao = 'RGPD_TITULAR_ANONIMIZADO' AND "entidadeId" = $1`, [antigo])).rowCount ?? 0;
      if (!auditado) await new Promise((ok) => setTimeout(ok, 250));
    }
    expect(auditado).toBe(1);
  });
});
