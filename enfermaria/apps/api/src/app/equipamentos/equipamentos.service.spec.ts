import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EquipamentosService } from './equipamentos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  equipamento: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  manutencao: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const equipamentoBase = { id: 'eq-1', nome: 'Monitor', tipo: 'monitor_vitais', estado: 'operacional' };

describe('EquipamentosService', () => {
  let service: EquipamentosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.equipamento.findMany.mockResolvedValue([]);
    mockPrisma.manutencao.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EquipamentosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<EquipamentosService>(EquipamentosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve equipamentos', async () => {
      mockPrisma.equipamento.findMany.mockResolvedValue([equipamentoBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });

  describe('criar()', () => {
    it('cria equipamento', async () => {
      mockPrisma.equipamento.create.mockResolvedValue(equipamentoBase);
      const r = await service.criar({ nome: 'Monitor', tipo: 'monitor_vitais' });
      expect(r.nome).toBe('Monitor');
    });
  });

  describe('atualizar()', () => {
    it('atualiza equipamento', async () => {
      mockPrisma.equipamento.findUnique.mockResolvedValue(equipamentoBase);
      mockPrisma.equipamento.update.mockResolvedValue({ ...equipamentoBase, nome: 'Monitor HD' });
      const r = await service.atualizar('eq-1', { nome: 'Monitor HD' });
      expect(r.nome).toBe('Monitor HD');
    });

    it('lança NotFoundException quando equipamento não existe', async () => {
      mockPrisma.equipamento.findUnique.mockResolvedValue(null);
      await expect(service.atualizar('x', { nome: 'Y' })).rejects.toThrow(NotFoundException);
    });
  });
});
