import { Test, TestingModule } from '@nestjs/testing';
import { RhService } from './rh.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  ausencia: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  utilizador: { findUnique: jest.fn(), findMany: jest.fn() },
};

const ausenciaBase = { id: 'aus-1', utilizadorId: 'u1', tipo: 'ferias', estado: 'pendente' };

describe('RhService', () => {
  let service: RhService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.ausencia.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RhService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<RhService>(RhService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criarAusencia()', () => {
    it('cria ausência', async () => {
      mockPrisma.ausencia.create.mockResolvedValue(ausenciaBase);
      const r = await service.criarAusencia('u1', { tipo: 'ferias', dataInicio: '2026-07-01', dataFim: '2026-07-15' });
      expect(r.tipo).toBe('ferias');
    });
  });

  describe('listarAusencias()', () => {
    it('devolve ausências', async () => {
      mockPrisma.ausencia.findMany.mockResolvedValue([ausenciaBase]);
      const r = await service.listarAusencias({});
      expect(r).toHaveLength(1);
    });
  });
});
