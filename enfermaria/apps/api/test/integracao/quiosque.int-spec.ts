import { arrancar, parar, entrar, Contexto, Resposta } from './app-teste';

/**
 * SEC-12 — quiosque: o NIF fica cifrado (com índice cego), a identificação exige NIF + data de
 * nascimento e devolve só o nome abreviado, e marcar exige essa identificação.
 */
describe('integração: quiosque (SEC-12)', () => {
  let ctx: Contexto;
  let tokenQuiosque = '';
  // UX-23: o registo valida o dígito de controlo — gera-se um NIF válido (prefixo 2).
  const base = '2' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const resto = [...base].reduce((s, d, i) => s + Number(d) * (9 - i), 0) % 11;
  const nif = base + String(resto < 2 ? 0 : 11 - resto);

  const quiosque = async (metodo: string, caminho: string, corpo?: unknown, cab: Record<string, string> = {}): Promise<Resposta> => {
    const r = await fetch(ctx.url + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenQuiosque}`, ...cab },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    let json: any = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, json, cabecalhos: r.headers };
  };

  beforeAll(async () => {
    ctx = await arrancar();
    const adm = await entrar(ctx, '00007');
    const t = await adm.pedido('POST', '/doentes/quiosque-token?servicoId=consulta');
    expect(t.status).toBe(201);
    tokenQuiosque = t.json.token;
    const r = await adm.pedido('POST', '/doentes/registro-rapido', {
      nome: 'Quitéria Fernanda Quiosque', dataNascimento: '1958-04-23', nif, numeroSNS: String(Date.now()).slice(-9), telefone: '912000111',
    });
    expect([200, 201]).toContain(r.status);
  });
  afterAll(async () => { await parar(ctx); });

  it('o NIF está cifrado na BD e tem índice cego', async () => {
    const r = await ctx.bd.query(`SELECT nif, "nifBusca" FROM fichas_pessoais_doente WHERE "nifBusca" IS NOT NULL`);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.some((x) => x.nif === nif)).toBe(false);
    expect(r.rows.every((x) => String(x.nif).startsWith('enc:'))).toBe(true);
  });

  it('o NIF sozinho (ou com a data errada) não identifica ninguém — sem dizer qual falhou', async () => {
    const errada = await quiosque('POST', '/quiosque/identificar', { nif, dataNascimento: '1958-04-24' });
    const desconhecido = await quiosque('POST', '/quiosque/identificar', { nif: '199999999', dataNascimento: '1958-04-23' });
    expect(errada.status).toBe(401);
    expect(desconhecido.status).toBe(401);
    expect(errada.json.message).toBe(desconhecido.json.message);
    expect((await quiosque('GET', `/quiosque/paciente?nif=${nif}`)).status).toBe(404); // a rota antiga já não existe
  });

  it('NIF + data de nascimento: nome abreviado e identificação para ver as marcações e marcar', async () => {
    const r = await quiosque('POST', '/quiosque/identificar', { nif, dataNascimento: '1958-04-23' });
    expect(r.status).toBe(201);
    expect(r.json.nome).toBe('Quitéria Q.');
    expect(JSON.stringify(r.json)).not.toContain('1958');

    const semId = await quiosque('GET', '/quiosque/identificacao/marcacoes-hoje');
    expect(semId.status).toBe(401);
    const comId = await quiosque('GET', '/quiosque/identificacao/marcacoes-hoje', undefined, { 'x-quiosque-identificacao': r.json.identificacao });
    expect(comId.status).toBe(200);
    expect(Array.isArray(comId.json)).toBe(true);

    // Marcar exige a identificação (e ignora qualquer doenteId no corpo).
    const marcar = await quiosque('POST', '/quiosque/marcacao-nova', { medicoId: '00000000-0000-0000-0000-000000000000', dataHora: '2030-01-01T10:00:00.000Z' });
    expect(marcar.status).toBe(401);
  });
});
