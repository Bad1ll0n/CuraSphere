import { Test, TestingModule } from '@nestjs/testing';
import { IncidentesTIService } from './incidentes-ti.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  incidenteTI: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const incidenteBase = { id: 'inc-1', titulo: 'Falha HIS', tipo: 'his_erp', estado: 'aberto' };

describe('IncidentesTIService', () => {
  let service: IncidentesTIService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.incidenteTI.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [IncidentesTIService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<IncidentesTIService>(IncidentesTIService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria incidente TI', async () => {
      mockPrisma.incidenteTI.create.mockResolvedValue(incidenteBase);
      const r = await service.criar({ titulo: 'Falha HIS', descricao: 'Erro', tipo: 'his_erp' } as any, 'ti-1');
      expect(r.titulo).toBe('Falha HIS');
    });
  });

  describe('listar()', () => {
    it('devolve incidentes', async () => {
      mockPrisma.incidenteTI.findMany.mockResolvedValue([incidenteBase]);
      const r = await service.listar('u1', 'ti');
      expect(r).toHaveLength(1);
    });
  });
});
