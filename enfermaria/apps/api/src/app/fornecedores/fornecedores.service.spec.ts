import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  fornecedor: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  encomendaFornecedor: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  stockItem: { findUnique: jest.fn() },
};

const fornecedorBase = { id: 'f-1', nome: 'Farma Lda', ativo: true };

describe('FornecedoresService', () => {
  let service: FornecedoresService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.fornecedor.findMany.mockResolvedValue([]);
    mockPrisma.encomendaFornecedor.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [FornecedoresService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<FornecedoresService>(FornecedoresService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve fornecedores ativos', async () => {
      mockPrisma.fornecedor.findMany.mockResolvedValue([fornecedorBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });

  describe('criar()', () => {
    it('cria fornecedor', async () => {
      mockPrisma.fornecedor.create.mockResolvedValue(fornecedorBase);
      const r = await service.criar({ nome: 'Farma Lda' });
      expect(r.nome).toBe('Farma Lda');
    });
  });

  describe('atualizar()', () => {
    it('atualiza fornecedor', async () => {
      mockPrisma.fornecedor.findUnique.mockResolvedValue(fornecedorBase);
      mockPrisma.fornecedor.update.mockResolvedValue({ ...fornecedorBase, nome: 'Farma SA' });
      const r = await service.atualizar('f-1', { nome: 'Farma SA' });
      expect(r.nome).toBe('Farma SA');
    });

    it('lança NotFoundException quando fornecedor não existe', async () => {
      mockPrisma.fornecedor.findUnique.mockResolvedValue(null);
      await expect(service.atualizar('x', { nome: 'Y' })).rejects.toThrow(NotFoundException);
    });
  });
});
