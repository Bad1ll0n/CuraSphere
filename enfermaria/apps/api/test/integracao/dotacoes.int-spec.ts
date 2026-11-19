import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, idDe, Contexto } from './app-teste';

/**
 * PROD-17 — dotação segura e escala por serviço, contra a BD real: dependência dos doentes →
 * horas necessárias vs enfermeiros escalados; parâmetros do serviço; escala do serviço A e
 * depois do B (antes, a do B não criava nenhum turno); histórico.
 */
describe('integração: dotações e escalas por serviço', () => {
  let ctx: Contexto;
  const A = `INT-DOT-A-${Date.now()}`;
  const B = `INT-DOT-B-${Date.now()}`;
  const mes = 3, ano = 2031; // um mês sem escalas de outros testes

  beforeAll(async () => {
    ctx = await arrancar();
    const enf = await idDe(ctx, '00003');
    // Serviço A: 3 doentes internados — Barthel 15 (IV), 50 (III) e sem Barthel (II).
    for (const [i, barthel] of [[1, 15], [2, 50], [3, null]] as const) {
      const camaId = randomUUID(), doenteId = randomUUID();
      await ctx.bd.query(`INSERT INTO camas (id, numero, quarto, estado, servico) VALUES ($1, $2, 'D', 'ocupada', $3)`, [camaId, `${A}-${i}`, A]);
      await ctx.bd.query(
        `INSERT INTO doentes (id, nome, "numeroProcesso", "camaId", "estadoRegisto", "dataAdmissao") VALUES ($1, $2, $3, $4, 'internado', now())`,
        [doenteId, `Doente dotação ${i}`, `DOT-${doenteId.slice(0, 8)}`, camaId],
      );
      if (barthel != null) {
        await ctx.bd.query(`INSERT INTO escalas_clinicas (id, "doenteId", "registadoPorId", tipo, valores, pontuacao) VALUES ($1, $2, $3, 'Barthel', '{}', $4)`, [randomUUID(), doenteId, enf, barthel]);
      }
    }
    // Pessoal: 6 enfermeiros em A (um com SAV), 6 em B.
    for (const [s, n] of [[A, 6], [B, 6]] as const) {
      for (let i = 0; i < n; i++) {
        await ctx.bd.query(
          `INSERT INTO utilizadores (id, "numeroFuncionario", nome, "passwordHash", role, unidade, competencias, "atualizadoEm") VALUES ($1, $2, $3, 'x', 'enfermeiro', $4, $5, now())`,
          [randomUUID(), `D${randomUUID().slice(0, 10)}`, `Enf ${s} ${i}`, s, s === A && i === 0 ? ['SAV'] : []],
        );
      }
    }
  });
  afterAll(async () => { await parar(ctx); });

  it('dependência e horas necessárias do serviço; sem ninguém escalado, insuficiente', async () => {
    const chefe = await entrar(ctx, '00015');
    const r = await chefe.pedido('GET', `/dotacoes/servicos/${A}?data=${ano}-0${mes}-10&turno=manha`);
    expect(r.status).toBe(200);
    // IV 9 h + III 6 h + II 4 h = 19 h/24 h; manhã 45 % = 8,6 h.
    expect(r.json).toMatchObject({ doentes: 3, porCategoria: { I: 0, II: 1, III: 1, IV: 1 }, horasNecessarias: 8.6, enfermeiros: 0, semaforo: 'vermelho', parametrosPersonalizados: false });
    expect(r.json.detalhe.map((d: any) => d.categoria).sort()).toEqual(['II', 'III', 'IV']);
  });

  it('parâmetros do serviço: validados e guardados', async () => {
    const chefe = await entrar(ctx, '00015');
    const p = (await chefe.pedido('GET', `/dotacoes/servicos/${A}/parametros`)).json;
    const { servico: _s, personalizados: _p, ...corpo } = p;
    expect((await chefe.pedido('PUT', `/dotacoes/servicos/${A}/parametros`, { ...corpo, distribuicaoTurno: { manha: 0.6, tarde: 0.6, noite: 0.2 } })).status).toBe(400);
    const minimos = { enfermeiro: 1, auxiliar: 0, medico: 0 };
    const ok = await chefe.pedido('PUT', `/dotacoes/servicos/${A}/parametros`, { ...corpo, minimos: { manha: minimos, tarde: minimos, noite: minimos }, competenciaObrigatoria: 'SAV' });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ personalizados: true, competenciaObrigatoria: 'SAV' });
    // Um enfermeiro (sem chefia) não altera parâmetros.
    const enf = await entrar(ctx, '00003');
    expect((await enf.pedido('PUT', `/dotacoes/servicos/${A}/parametros`, corpo)).status).toBe(403);
  });

  it('escala do serviço A e depois do B — cada uma com os seus turnos; a dotação conta os escalados', async () => {
    const chefe = await entrar(ctx, '00015');
    const ga = await chefe.pedido('POST', '/horarios/gerar-automatico', { mes, ano, servico: A });
    expect(ga.status).toBe(201);
    expect(ga.json.escala.servico).toBe(A);
    expect(ga.json.turnosCriados).toBeGreaterThan(0);
    // Um só enfermeiro com SAV para 3 turnos por dia: o que não se cumpre vem em faltas.
    expect(ga.json.faltas.some((f: any) => /SAV/.test(f.motivo))).toBe(true);

    const gb = await chefe.pedido('POST', '/horarios/gerar-automatico', { mes, ano, servico: B });
    // Antes: 0 turnos (deduplicação por tipo+data entre serviços). Agora a escala de B existe —
    // e, com os mínimos de referência (2 por turno), 6 enfermeiros a 40 h/semana não chegam:
    // a falta aparece em vez de se pôr alguém a fazer horas a mais.
    expect(gb.json.turnosCriados).toBeGreaterThan(0);
    expect(gb.json.faltas.length).toBeGreaterThan(0);
    const horas = await ctx.bd.query(
      `SELECT max(n)::int AS max FROM (SELECT p."utilizadorId", date_trunc('week', t.data) s, count(*) * 8 AS n FROM horarios_turno_profissionais p JOIN horarios_turno t ON t.id = p."horarioTurnoId" JOIN escalas e ON e.id = t."escalId" WHERE e.servico = $1 GROUP BY 1, 2) x`,
      [B],
    );
    expect(horas.rows[0].max).toBeLessThanOrEqual(40);

    const escB = await ctx.bd.query(`SELECT count(*)::int AS n FROM escalas WHERE mes = $1 AND ano = $2 AND servico = $3`, [mes, ano, B]);
    expect(escB.rows[0].n).toBe(1);
    // Ninguém de B entrou na escala de A.
    const misturados = await ctx.bd.query(
      `SELECT count(*)::int AS n FROM horarios_turno_profissionais p JOIN horarios_turno t ON t.id = p."horarioTurnoId" JOIN escalas e ON e.id = t."escalId" JOIN utilizadores u ON u.id = p."utilizadorId" WHERE e.servico = $1 AND u.unidade <> $1`,
      [A],
    );
    expect(misturados.rows[0].n).toBe(0);

    const r = await chefe.pedido('GET', `/dotacoes/servicos/${A}?data=${ano}-0${mes}-10&turno=manha`);
    expect(r.json.enfermeiros).toBe(1);
    expect(r.json.horasDisponiveis).toBe(7);
  });

  it('histórico: a fotografia do turno fica registada e substitui-se no mesmo turno', async () => {
    const chefe = await entrar(ctx, '00015');
    expect((await chefe.pedido('POST', `/dotacoes/servicos/${A}/registar`, {})).status).toBe(201);
    expect((await chefe.pedido('POST', `/dotacoes/servicos/${A}/registar`, {})).status).toBe(201);
    const h = await chefe.pedido('GET', `/dotacoes/servicos/${A}/historico?dias=2`);
    expect(h.json).toHaveLength(1);
    expect(h.json[0]).toMatchObject({ doentes: 3, porCategoria: { II: 1, III: 1, IV: 1 } });
  });
});
