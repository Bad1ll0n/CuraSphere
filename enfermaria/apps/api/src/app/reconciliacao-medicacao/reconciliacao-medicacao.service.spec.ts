import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReconciliacaoMedicacaoService } from './reconciliacao-medicacao.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  reconciliacaoMedicacao: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const reconciliacaoBase = { id: 'rec-1', doenteId: 'd1', medicacaoCasa: '[]', discrepancias: '[]' };

describe('ReconciliacaoMedicacaoService', () => {
  let service: ReconciliacaoMedicacaoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.reconciliacaoMedicacao.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReconciliacaoMedicacaoService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<ReconciliacaoMedicacaoService>(ReconciliacaoMedicacaoService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria reconciliação de medicação', async () => {
      mockPrisma.reconciliacaoMedicacao.create.mockResolvedValue(reconciliacaoBase);
      const r = await service.criar('d1', { medicacaoCasa: '[]' } as any, 'med-1');
      expect(r.doenteId).toBe('d1');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', { medicacaoCasa: '[]' } as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
