import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExamesService } from './exames.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: { findUnique: jest.fn() },
  exame: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  episodioFaturacao: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  itemFatura: { create: jest.fn() },
  atoClinico: { findFirst: jest.fn() },
};

const exameBase = {
  id: 'ex-1', doenteId: 'd1', tipo: 'radiografia', descricao: 'RX Tórax',
  estado: 'solicitado', solicitadoPorId: 'med-1', urgente: false,
};

describe('ExamesService', () => {
  let service: ExamesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn),
    );
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana', ativo: true });
    mockPrisma.episodioFaturacao.findFirst.mockResolvedValue({ id: 'ep-1' }); // skip auto-billing

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExamesService>(ExamesService);
  });

  describe('solicitar()', () => {
    it('cria solicitação de exame', async () => {
      mockPrisma.exame.create.mockResolvedValue(exameBase);

      const resultado = await service.solicitar('d1', { tipo: 'radiografia', descricao: 'RX Tórax' }, 'med-1');

      expect(resultado.tipo).toBe('radiografia');
    });
  });

  describe('listar()', () => {
    it('devolve exames do doente', async () => {
      mockPrisma.exame.findMany.mockResolvedValue([exameBase]);

      const resultado = await service.listar('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('registarResultado()', () => {
    it('lança NotFoundException quando exame não existe', async () => {
      mockPrisma.exame.findUnique.mockResolvedValue(null);

      await expect(service.registarResultado('x', { resultado: 'Normal' }, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('regista resultado do exame', async () => {
      mockPrisma.exame.findUnique.mockResolvedValue(exameBase);
      mockPrisma.exame.update.mockResolvedValue({ ...exameBase, resultado: 'Normal', estado: 'concluido' });

      const resultado = await service.registarResultado('ex-1', { resultado: 'Normal' }, 'u1');

      expect(resultado.estado).toBe('concluido');
    });
  });

  describe('atualizarEstado()', () => {
    it('lança NotFoundException quando exame não existe', async () => {
      mockPrisma.exame.findUnique.mockResolvedValue(null);

      await expect(service.atualizarEstado('x', 'em_curso')).rejects.toThrow(NotFoundException);
    });

    it('actualiza estado do exame', async () => {
      mockPrisma.exame.findUnique.mockResolvedValue(exameBase);
      mockPrisma.exame.update.mockResolvedValue({ ...exameBase, estado: 'em_curso' });

      const resultado = await service.atualizarEstado('ex-1', 'em_curso');

      expect(resultado.estado).toBe('em_curso');
    });
  });
});
