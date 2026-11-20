import { randomUUID } from 'crypto';
import { arrancar, parar, entrar, criarDoenteInternado, idDe, Contexto } from './app-teste';

/**
 * PERF-14 — o painel de carga do turno agrupa as contagens por doente (4 consultas no total). O
 * groupBy com filtro de relação (`registos: none`) confirma-se aqui contra o Postgres real.
 */
describe('integração: carga do turno (PERF-14)', () => {
  let ctx: Contexto;
  beforeAll(async () => { ctx = await arrancar(); });
  afterAll(async () => { await parar(ctx); });

  it('devolve, por doente atribuído no turno, medicação por administrar, tarefas em atraso, alertas e o último sinal vital', async () => {
    const enf = await idDe(ctx, '00003');
    const [a, b] = [await criarDoenteInternado(ctx), await criarDoenteInternado(ctx)];
    const escala = randomUUID();
    await ctx.bd.query(`INSERT INTO escalas (id, mes, ano, servico, "criadaPorId") VALUES ($1, 1, 2099, $2, $3)`, [escala, `PERF14-${escala.slice(0, 6)}`, enf]);
    // Os três turnos de hoje e a noite de ontem: o que estiver em curso apanha as atribuições.
    for (const [tipo, desvio] of [['manha', 0], ['tarde', 0], ['noite', 0], ['noite', -1]] as const) {
      const turno = randomUUID();
      await ctx.bd.query(`INSERT INTO horarios_turno (id, tipo, data, "escalId") VALUES ($1, $2, now() + ($3 || ' day')::interval, $4)`, [turno, tipo, String(desvio), escala]);
      for (const d of [a, b]) {
        await ctx.bd.query(`INSERT INTO atribuicoes_horario_turno (id, "horarioTurnoId", "doenteId", "utilizadorId", "atribuidoPorId") VALUES ($1, $2, $3, $4, $4)`,
          [randomUUID(), turno, d.doenteId, enf]);
      }
    }
    const sessao = await entrar(ctx, '00003');
    expect((await sessao.pedido('POST', `/sinais-vitais/${b.doenteId}`, { pulso: 80, saturacaoO2: 97, temperatura: 36.8, pressaoSistolica: 120, pressaoDiastolica: 75, frequenciaRespiratoria: 15 })).status).toBe(201);
    await ctx.bd.query(`INSERT INTO alertas_clinicos (id, "doenteId", tipo, mensagem, severidade, lido) VALUES ($1, $2, 'teste', 'alerta de teste', 3, false)`, [randomUUID(), a.doenteId]);

    const r = await sessao.pedido('GET', '/dashboard/workload-turno');
    expect(r.status).toBe(200);
    const porId = new Map((r.json as any[]).map((x) => [x.doente.id, x]));
    expect(porId.size).toBe(2);
    expect(porId.get(b.doenteId).ultimoSinalVital).not.toBeNull();
    expect(porId.get(a.doenteId).ultimoSinalVital).toBeNull();
    expect(porId.get(a.doenteId).alertasNaoLidos).toBe(1);
    expect(porId.get(b.doenteId).alertasNaoLidos).toBe(0);
    for (const x of porId.values()) {
      expect(typeof x.medicacoesPendentes).toBe('number');
      expect(typeof x.tarefasAtrasadas).toBe('number');
      expect(typeof x.alertasNaoLidos).toBe('number');
    }
  });
});
