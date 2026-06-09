import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DietasService } from './dietas.service';
import { PrismaService } from '../prisma/prisma.service';

const mockTx = {
  prescricaoDieta: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(),
  doente: { findUnique: jest.fn(), findMany: jest.fn() },
  prescricaoDieta: { findFirst: jest.fn(), findMany: jest.fn() },
};

const dietaBase = { id: 'd-1', doenteId: 'd1', tipo: 'normal', ativa: true };

describe('DietasService', () => {
  let service: DietasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockTx));
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });
    mockTx.prescricaoDieta.updateMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DietasService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<DietasService>(DietasService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('prescrever()', () => {
    it('prescreve dieta', async () => {
      mockTx.prescricaoDieta.create.mockResolvedValue(dietaBase);
      const r = await service.prescrever({ doenteId: 'd1', tipo: 'normal', criadaPorId: 'med-1' });
      expect(r.tipo).toBe('normal');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.prescrever({ doenteId: 'x', tipo: 'normal', criadaPorId: 'med-1' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('dietaAtual()', () => {
    it('devolve dieta activa', async () => {
      mockPrisma.prescricaoDieta.findFirst.mockResolvedValue(dietaBase);
      const r = await service.dietaAtual('d1');
      expect(r.tipo).toBe('normal');
    });
  });

  describe('historico()', () => {
    it('devolve histórico de dietas', async () => {
      mockPrisma.prescricaoDieta.findMany.mockResolvedValue([dietaBase]);
      const r = await service.historico('d1');
      expect(r).toHaveLength(1);
    });
  });
});
