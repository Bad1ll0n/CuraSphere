import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TenantContextService } from '../prisma/tenant-context.service';

const mockPrisma = {
  doente: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  cama: { count: jest.fn(), groupBy: jest.fn() },
  sinalVital: { findMany: jest.fn(), groupBy: jest.fn() },
  tarefa: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  atribuicaoHorarioTurno: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  horarioTurno: { findFirst: jest.fn() },
  alertaClinico: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  avaliacaoRisco: { count: jest.fn(), groupBy: jest.fn() },
  medicacao: { count: jest.fn(), groupBy: jest.fn() },
  registoMedicacao: { count: jest.fn() },
  sumarioAlta: { count: jest.fn() },
  notaTurno: { count: jest.fn(), findMany: jest.fn() },
  utilizador: { count: jest.fn(), findMany: jest.fn() },
  eventoAdverso: { count: jest.fn(), findMany: jest.fn() },
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Defaults para chamadas findMany/count/groupBy
    Object.values(mockPrisma).forEach((model: any) => {
      if (model.count) model.count.mockResolvedValue(0);
      if (model.findMany) model.findMany.mockResolvedValue([]);
      if (model.groupBy) model.groupBy.mockResolvedValue([]);
      if (model.aggregate) model.aggregate.mockResolvedValue({ _sum: { totalCobrado: 0 } });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        // PERF-06: cache — o Redis devolve sempre miss nos testes.
        { provide: RedisService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantContextService, useValue: { tenantId: 'default' } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('é definido', () => {
    expect(service).toBeDefined();
  });

  describe('analytics()', () => {
    it('devolve dados de analytics sem erros', async () => {
      const resultado = await service.analytics();
      expect(resultado).toBeDefined();
    });
  });

  describe('dashboardQualidade()', () => {
    it('devolve métricas de qualidade', async () => {
      const resultado = await service.dashboardQualidade();
      expect(resultado).toBeDefined();
    });
  });

  describe('news2Distribuicao()', () => {
    it('devolve distribuição NEWS2', async () => {
      mockPrisma.sinalVital.groupBy.mockResolvedValue([
        { news2: 0, _count: { news2: 5 } },
        { news2: 3, _count: { news2: 2 } },
      ]);

      const resultado = await service.news2Distribuicao();

      expect(resultado).toBeDefined();
    });
  });

  describe('workloadTurno() — PERF-14', () => {
    it('faz 4 consultas no total (agrupadas por doente), não 4 por doente', async () => {
      const doente = (id: string) => ({ doenteId: id, doente: { id, nome: `D ${id}`, cama: { numero: '1', quarto: 'A' } } });
      mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([doente('d1'), doente('d2'), doente('d3')]);
      mockPrisma.medicacao.groupBy.mockResolvedValue([{ doenteId: 'd1', _count: { _all: 2 } }]);
      mockPrisma.tarefa.groupBy.mockResolvedValue([{ doenteId: 'd2', _count: { _all: 1 } }]);
      mockPrisma.alertaClinico.groupBy.mockResolvedValue([{ doenteId: 'd1', _count: { _all: 3 } }]);
      mockPrisma.sinalVital.groupBy.mockResolvedValue([{ doenteId: 'd3', _max: { data: new Date('2026-11-20T08:00:00Z') } }]);

      const r = await service.workloadTurno('u1');

      for (const m of [mockPrisma.medicacao, mockPrisma.tarefa, mockPrisma.alertaClinico, mockPrisma.sinalVital]) {
        expect(m.groupBy).toHaveBeenCalledTimes(1);
        expect(m.groupBy.mock.calls[0][0].where.doenteId).toEqual({ in: ['d1', 'd2', 'd3'] });
      }
      expect(mockPrisma.medicacao.count).not.toHaveBeenCalled();
      expect(r).toEqual([
        { doente: { id: 'd1', nome: 'D d1', cama: '1', quarto: 'A' }, medicacoesPendentes: 2, tarefasAtrasadas: 0, alertasNaoLidos: 3, ultimoSinalVital: null },
        { doente: { id: 'd2', nome: 'D d2', cama: '1', quarto: 'A' }, medicacoesPendentes: 0, tarefasAtrasadas: 1, alertasNaoLidos: 0, ultimoSinalVital: null },
        { doente: { id: 'd3', nome: 'D d3', cama: '1', quarto: 'A' }, medicacoesPendentes: 0, tarefasAtrasadas: 0, alertasNaoLidos: 0, ultimoSinalVital: '2026-11-20T08:00:00.000Z' },
      ]);
    });

    it('sem doentes atribuídos não consulta mais nada', async () => {
      mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([]);
      expect(await service.workloadTurno('u1')).toEqual([]);
      expect(mockPrisma.sinalVital.groupBy).not.toHaveBeenCalled();
    });
  });
});
