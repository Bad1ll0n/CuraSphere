import { Test, TestingModule } from '@nestjs/testing';
import { DashboardConfigService } from './dashboard-config.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  dashboardConfig: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
};

const widgetsBase = [{ id: 'w1', x: 0, y: 0, w: 4, h: 2, visible: true }];

describe('DashboardConfigService', () => {
  let service: DashboardConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardConfigService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<DashboardConfigService>(DashboardConfigService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('getConfig()', () => {
    it('devolve configuração do utilizador', async () => {
      mockPrisma.dashboardConfig.findUnique.mockResolvedValue({ userId: 'u1', widgets: widgetsBase });
      const r = await service.getConfig('u1');
      expect(r).toHaveLength(1);
    });

    it('devolve null quando não existe configuração', async () => {
      mockPrisma.dashboardConfig.findUnique.mockResolvedValue(null);
      const r = await service.getConfig('u1');
      expect(r).toBeNull();
    });
  });

  describe('saveConfig()', () => {
    it('guarda configuração via upsert', async () => {
      mockPrisma.dashboardConfig.upsert.mockResolvedValue({ userId: 'u1', widgets: widgetsBase });
      await service.saveConfig('u1', widgetsBase);
      expect(mockPrisma.dashboardConfig.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetConfig()', () => {
    it('apaga configuração do utilizador', async () => {
      mockPrisma.dashboardConfig.deleteMany.mockResolvedValue({ count: 1 });
      await service.resetConfig('u1');
      expect(mockPrisma.dashboardConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });
});
