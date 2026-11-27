import { ultimasAdministracoes, ultimosSinaisVitais } from './ultimos-registos';
import { DashboardService } from '../dashboard/dashboard.service';

// PERF-03: uma linha por doente/medicação, numa query — não o histórico inteiro.
describe('ultimos-registos (PERF-03)', () => {
  it('lista vazia não vai à BD', async () => {
    const prisma = { $queryRaw: jest.fn() };
    expect((await ultimosSinaisVitais(prisma as never, [])).size).toBe(0);
    expect((await ultimasAdministracoes(prisma as never, [])).size).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('usa LATERAL … LIMIT 1 por doente e devolve um mapa', async () => {
    const data = new Date('2026-11-06T08:00:00Z');
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ doenteId: 'd1', news2: 5, data }]) };
    const m = await ultimosSinaisVitais(prisma as never, ['d1', 'd2'], { comNews2: true });
    const sql = (prisma.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toMatch(/CROSS JOIN LATERAL/);
    expect(sql).toMatch(/ORDER BY data DESC LIMIT 1/);
    expect(m.get('d1')).toEqual({ news2: 5, data });
    expect(m.has('d2')).toBe(false);
  });
});

// PERF-06: o dashboard é calculado uma vez por janela de cache, não por espectador.
describe('cache dos dashboards (PERF-06)', () => {
  it('a segunda leitura não recalcula', async () => {
    const prisma = { doente: { findMany: jest.fn().mockResolvedValue([]) }, $queryRaw: jest.fn() };
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    const s = new DashboardService(prisma as never, redis as never, { tenantId: 't1' } as never);
    await s.news2Distribuicao();
    await s.news2Distribuicao();
    expect(prisma.doente.findMany).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('dashboard:news2Distribuicao:t1', expect.anything(), expect.any(Number));
  });

  it('usa o valor de outra réplica (Redis) sem recalcular', async () => {
    const prisma = { doente: { findMany: jest.fn() } };
    const redis = { get: jest.fn().mockResolvedValue({ totalAtivos: 7 }), set: jest.fn() };
    const s = new DashboardService(prisma as never, redis as never, { tenantId: 't1' } as never);
    expect(await s.news2Distribuicao()).toEqual({ totalAtivos: 7 });
    expect(prisma.doente.findMany).not.toHaveBeenCalled();
  });
});
