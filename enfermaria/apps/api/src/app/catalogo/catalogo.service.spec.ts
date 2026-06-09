import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const mockPrisma = {
  catalogoMedicamento: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const medicamentoBase = { id: 'med-1', dci: 'Paracetamol', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg', ativo: true };

describe('CatalogoService', () => {
  let service: CatalogoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.catalogoMedicamento.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<CatalogoService>(CatalogoService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve resultado da BD quando cache vazio', async () => {
      mockPrisma.catalogoMedicamento.findMany.mockResolvedValue([medicamentoBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });

    it('devolve cache quando existe', async () => {
      mockRedis.get.mockResolvedValue([medicamentoBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
      expect(mockPrisma.catalogoMedicamento.findMany).not.toHaveBeenCalled();
    });

    it('pesquisa directa na BD quando search fornecido', async () => {
      mockPrisma.catalogoMedicamento.findMany.mockResolvedValue([medicamentoBase]);
      const r = await service.listar('para');
      expect(r).toHaveLength(1);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });

  describe('criar()', () => {
    it('cria medicamento e invalida cache', async () => {
      mockPrisma.catalogoMedicamento.create.mockResolvedValue(medicamentoBase);
      const r = await service.criar({ dci: 'Paracetamol', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg' });
      expect(r.dci).toBe('Paracetamol');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('atualizar()', () => {
    it('lança NotFoundException quando medicamento não existe', async () => {
      mockPrisma.catalogoMedicamento.findUnique.mockResolvedValue(null);
      await expect(service.atualizar('x', { dci: 'X' })).rejects.toThrow(NotFoundException);
    });
  });
});
