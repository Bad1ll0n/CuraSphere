import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BalancoHidricoService } from './balanco-hidrico.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  balancoHidrico: { create: jest.fn(), findMany: jest.fn() },
};

const registoBase = { id: 'bh-1', doenteId: 'd1', tipo: 'entrada', categoria: 'oral', quantidade: 200 };

describe('BalancoHidricoService', () => {
  let service: BalancoHidricoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana', ativo: true });
    mockPrisma.balancoHidrico.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [BalancoHidricoService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<BalancoHidricoService>(BalancoHidricoService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registar()', () => {
    it('regista entrada/saída hídrica', async () => {
      mockPrisma.balancoHidrico.create.mockResolvedValue(registoBase);
      const r = await service.registar('d1', { tipo: 'entrada', categoria: 'oral', quantidade: 200 } as any, 'enf-1', 'enfermeiro');
      expect(r.quantidade).toBe(200);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.registar('x', { tipo: 'entrada', categoria: 'oral', quantidade: 100 } as any, 'u1', 'enfermeiro'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('listar()', () => {
    it('devolve balanço do dia', async () => {
      mockPrisma.balancoHidrico.findMany.mockResolvedValue([registoBase]);
      const r = await service.listar('d1');
      expect(r.registos).toHaveLength(1);
    });
  });
});
