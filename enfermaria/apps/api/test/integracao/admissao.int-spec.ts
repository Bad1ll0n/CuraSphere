import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, Contexto } from './app-teste';

/** Gera um NIF válido (dígito de controlo) a partir de 8 dígitos começados por 2. */
function nifValidoAleatorio(): string {
  const base = '2' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const soma = [...base].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  return base + String(resto < 2 ? 0 : 11 - resto);
}

/**
 * UX-23 — registo administrativo: sem NIF/SNS obrigatórios, utente não identificado, possíveis
 * duplicados antes de criar (com a pesquisa no índice cego do NIF e do nome) e NIF repetido recusado.
 */
describe('integração: admissão administrativa', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('regista sem NIF nem SNS; encontra o duplicado por NIF e por nome + data; recusa o NIF repetido', async () => {
    const adm = await entrar(ctx, '00007');
    const nif = nifValidoAleatorio();
    const nome = `Estrangeira Teste ${randomUUID().slice(0, 6)}`;

    expect((await adm.pedido('POST', '/doentes/registro-rapido', { nome, dataNascimento: '1985-03-04', tipoVisita: 'consulta' })).status).toBe(201);
    const comNif = await adm.pedido('POST', '/doentes/registro-rapido', { nome: `${nome} B`, dataNascimento: '1990-01-01', nif, tipoVisita: 'consulta' });
    expect(comNif.status).toBe(201);

    const porNif = await adm.pedido('GET', `/doentes/possiveis-duplicados?nif=${nif}`);
    expect(porNif.status).toBe(200);
    expect(porNif.json.map((d: any) => d.motivo)).toEqual(['nif']);
    expect(porNif.json[0].numeroProcesso).toBe(comNif.json.numeroProcesso);

    const porNome = await adm.pedido('GET', `/doentes/possiveis-duplicados?nome=${encodeURIComponent(nome)}&dataNascimento=1985-03-04`);
    expect(porNome.json.some((d: any) => d.motivo === 'nome_e_data' && d.nome === nome)).toBe(true);

    const repetido = await adm.pedido('POST', '/doentes/registro-rapido', { nome: 'Outra Pessoa', dataNascimento: '1970-01-01', nif });
    expect(repetido.status).toBe(409);
    expect(repetido.json.message).toContain(comNif.json.numeroProcesso);

    expect((await adm.pedido('POST', '/doentes/registro-rapido', { nome: 'X', dataNascimento: '1970-01-01', nif: '999999999' })).status).toBe(400);
  });

  it('utente não identificado: identificação provisória numerada, sem mais dados', async () => {
    const adm = await entrar(ctx, '00007');
    const r = await adm.pedido('POST', '/doentes/registro-rapido', { provisorio: true, tipoVisita: 'urgencia' });
    expect(r.status).toBe(201);
    expect(r.json.nome).toMatch(/^Desconhecido \d{4}-\d{2}-\d{2} #\d+$/);
    const { rows } = await ctx.bd.query(`SELECT "identificacaoProvisoria", left(nome, 4) AS n FROM doentes WHERE id = $1`, [r.json.id]);
    expect(rows[0]).toEqual({ identificacaoProvisoria: true, n: 'enc:' }); // cifrado como qualquer nome
  });

  it('a pesquisa de duplicados é só da receção', async () => {
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('GET', '/doentes/possiveis-duplicados?nif=123456789')).status).toBe(403);
  });
});
