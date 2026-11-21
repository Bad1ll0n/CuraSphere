import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PedidosInternosService } from './pedidos-internos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  pedidoInterno: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const pedidoBase = { id: 'pi-1', tipo: 'transporte', descricao: 'Transporte doente', estado: 'pendente' };

describe('PedidosInternosService', () => {
  let service: PedidosInternosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.pedidoInterno.findMany.mockResolvedValue([]);
    mockPrisma.pedidoInterno.findUnique.mockResolvedValue(pedidoBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PedidosInternosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<PedidosInternosService>(PedidosInternosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria pedido interno', async () => {
      mockPrisma.pedidoInterno.create.mockResolvedValue(pedidoBase);
      const r = await service.criar({
        tipo: 'transporte', descricao: 'Transporte doente', prioridade: 'normal', servicoOrigem: 'cardiologia',
      }, 'u1');
      expect(r.tipo).toBe('transporte');
    });
  });

  describe('listar()', () => {
    it('devolve pedidos internos', async () => {
      mockPrisma.pedidoInterno.findMany.mockResolvedValue([pedidoBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });

    it('ARQ-23: activos todos, fechados só dos últimos 7 dias, e um tecto', async () => {
      mockPrisma.pedidoInterno.findMany.mockResolvedValue([]);
      await service.listar('Medicina');
      const { where, take } = mockPrisma.pedidoInterno.findMany.mock.calls.at(-1)[0];
      expect(take).toBe(500);
      expect(where.AND[0]).toEqual({ OR: [{ servicoOrigem: 'Medicina' }, { tipo: 'transporte', estado: 'pendente' }] });
      const [activos, recentes] = where.AND[1].OR;
      expect(activos).toEqual({ estado: { in: ['pendente', 'em_curso'] } });
      expect(Date.now() - recentes.criadoEm.gte.getTime()).toBeGreaterThan(6.9 * 24 * 3600_000);
    });
  });

  describe('aceitar()', () => {
    it('aceita pedido', async () => {
      mockPrisma.pedidoInterno.update.mockResolvedValue({ ...pedidoBase, estado: 'em_curso' });
      const r = await service.aceitar('pi-1', 'oper-1');
      expect(r.estado).toBe('em_curso');
    });

    it('lança NotFoundException quando pedido não existe', async () => {
      mockPrisma.pedidoInterno.findUnique.mockResolvedValue(null);
      await expect(service.aceitar('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
