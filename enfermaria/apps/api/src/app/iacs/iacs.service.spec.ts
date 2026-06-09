import { Test, TestingModule } from '@nestjs/testing';
import { IacsService } from './iacs.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  culturaMicrobiologica: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const culturaBase = { id: 'c-1', doenteId: 'd1', tipoAmostra: 'sangue', resultado: 'pendente' };

describe('IacsService', () => {
  let service: IacsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.culturaMicrobiologica.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [IacsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<IacsService>(IacsService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registarCultura()', () => {
    it('regista cultura microbiológica', async () => {
      mockPrisma.culturaMicrobiologica.create.mockResolvedValue(culturaBase);
      const r = await service.registarCultura({
        doenteId: 'd1', dataColheita: '2026-06-01', tipoAmostra: 'sangue',
      }, 'enf-1');
      expect(r.tipoAmostra).toBe('sangue');
    });
  });

  describe('listarCulturas()', () => {
    it('devolve culturas filtradas', async () => {
      mockPrisma.culturaMicrobiologica.findMany.mockResolvedValue([culturaBase]);
      const r = await service.listarCulturas({ doenteId: 'd1' });
      expect(r).toHaveLength(1);
    });
  });
});
