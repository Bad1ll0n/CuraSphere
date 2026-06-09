import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  cama: { count: jest.fn(), groupBy: jest.fn() },
  sinalVital: { findMany: jest.fn(), groupBy: jest.fn() },
  tarefa: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  atribuicaoHorarioTurno: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  horarioTurno: { findFirst: jest.fn() },
  alertaClinico: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  avaliacaoRisco: { count: jest.fn(), groupBy: jest.fn() },
  medicacao: { count: jest.fn() },
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
});
