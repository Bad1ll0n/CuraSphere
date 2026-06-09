import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FarmaciaService } from './farmacia.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockTx = {
  pedidoFarmacia: { findUnique: jest.fn(), update: jest.fn() },
  stockItem: { findUnique: jest.fn(), update: jest.fn() },
  transferenciaStock: { create: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(),
  stockItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ajusteStock: { create: jest.fn(), findMany: jest.fn() },
  pedidoFarmacia: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transferenciaStock: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const mockNotificacoes = { enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };

const itemBase = { id: 'item-1', nome: 'Paracetamol 1g', quantidade: 50, quantidadeMinima: 10, unidade: 'comp', validade: null, servico: 'medicina', solicitadoPorId: 'u1' };
const pedidoBase = { id: 'ped-1', stockItemId: 'item-1', quantidade: 5, servico: 'medicina', estado: 'pendente', solicitadoPorId: 'u1' };

describe('FarmaciaService', () => {
  let service: FarmaciaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmaciaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<FarmaciaService>(FarmaciaService);
  });

  // ── atualizarQuantidade() ────────────────────────────────────────────────────

  describe('atualizarQuantidade()', () => {
    it('lança NotFoundException quando item não existe', async () => {
      mockPrisma.stockItem.findUnique.mockResolvedValue(null);
      await expect(service.atualizarQuantidade('x', 10, 'teste', 'ajuste', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('actualiza quantidade e cria ajuste de stock', async () => {
      mockPrisma.stockItem.findUnique
        .mockResolvedValueOnce({ ...itemBase, quantidade: 50 }) // findUnique antes da transação
        .mockResolvedValueOnce({ ...itemBase, quantidade: 60 }); // findUnique final
      mockPrisma.stockItem.update.mockResolvedValue({});
      mockPrisma.ajusteStock.create.mockResolvedValue({});

      const resultado = await service.atualizarQuantidade('item-1', 60, 'Reposição', 'entrada', 'u1');

      expect(resultado.quantidade).toBe(60);
    });
  });

  // ── historicoAjustes() ───────────────────────────────────────────────────────

  describe('historicoAjustes()', () => {
    it('lança NotFoundException quando item não existe', async () => {
      mockPrisma.stockItem.findUnique.mockResolvedValue(null);
      await expect(service.historicoAjustes('x')).rejects.toThrow(NotFoundException);
    });

    it('devolve ajustes do item', async () => {
      mockPrisma.stockItem.findUnique.mockResolvedValue(itemBase);
      mockPrisma.ajusteStock.findMany.mockResolvedValue([{ id: 'a1', delta: 10 }]);

      const resultado = await service.historicoAjustes('item-1');
      expect(resultado).toHaveLength(1);
    });
  });

  // ── aprovarPedido() ──────────────────────────────────────────────────────────

  describe('aprovarPedido()', () => {
    it('lança NotFoundException quando pedido não existe', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue(null);
      await expect(service.aprovarPedido('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando pedido não está pendente', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'aprovado' });
      await expect(service.aprovarPedido('ped-1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('aprova pedido pendente e notifica solicitante', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue(pedidoBase);
      mockPrisma.pedidoFarmacia.update.mockResolvedValue({
        ...pedidoBase, estado: 'aprovado',
        stockItem: { nome: 'Paracetamol 1g', unidade: 'comp' },
        aprovadoPor: { id: 'u2', nome: 'Dr. Silva' },
        solicitadoPor: { id: 'u1', nome: 'Enf. Ana' },
      });

      await service.aprovarPedido('ped-1', 'u2');

      expect(mockPrisma.pedidoFarmacia.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'aprovado', aprovadoPorId: 'u2' }) }),
      );
      expect(mockNotificacoes.enviarParaUtilizador).toHaveBeenCalled();
    });
  });

  // ── rejeitarPedido() ─────────────────────────────────────────────────────────

  describe('rejeitarPedido()', () => {
    it('lança NotFoundException quando pedido não existe', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue(null);
      await expect(service.rejeitarPedido('x', 'u1', 'motivo')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando pedido não está pendente', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'dispensado' });
      await expect(service.rejeitarPedido('ped-1', 'u1', 'motivo')).rejects.toThrow(BadRequestException);
    });

    it('rejeita pedido e notifica solicitante', async () => {
      mockPrisma.pedidoFarmacia.findUnique.mockResolvedValue(pedidoBase);
      mockPrisma.pedidoFarmacia.update.mockResolvedValue({
        ...pedidoBase, estado: 'rejeitado',
        stockItem: { nome: 'Paracetamol 1g' },
        aprovadoPor: { id: 'u2', nome: 'Dr.' },
        solicitadoPor: { id: 'u1', nome: 'Enf.' },
      });

      await service.rejeitarPedido('ped-1', 'u2', 'Stock insuficiente');

      expect(mockPrisma.pedidoFarmacia.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'rejeitado', motivoRejeicao: 'Stock insuficiente' }) }),
      );
    });
  });

  // ── dispensar() ──────────────────────────────────────────────────────────────

  describe('dispensar()', () => {
    it('lança NotFoundException quando pedido não existe', async () => {
      mockTx.pedidoFarmacia.findUnique.mockResolvedValue(null);
      await expect(service.dispensar('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando pedido não está aprovado', async () => {
      mockTx.pedidoFarmacia.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'pendente' });
      await expect(service.dispensar('ped-1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando stock insuficiente', async () => {
      mockTx.pedidoFarmacia.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'aprovado', quantidade: 100 });
      mockTx.stockItem.findUnique.mockResolvedValue({ ...itemBase, quantidade: 5 });

      await expect(service.dispensar('ped-1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('dispensa e decrementa stock', async () => {
      mockTx.pedidoFarmacia.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'aprovado', stockItemId: 'item-1', quantidade: 5 });
      mockTx.stockItem.findUnique.mockResolvedValue({ ...itemBase, quantidade: 50 });
      mockTx.stockItem.update.mockResolvedValue({});
      mockTx.pedidoFarmacia.update.mockResolvedValue({ ...pedidoBase, estado: 'dispensado', stockItem: { nome: 'P', unidade: 'comp' } });

      const resultado = await service.dispensar('ped-1', 'u1');

      expect(mockTx.stockItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantidade: { decrement: 5 } } }),
      );
      expect(resultado.estado).toBe('dispensado');
    });
  });

  // ── alertas() ────────────────────────────────────────────────────────────────

  describe('alertas()', () => {
    it('identifica itens abaixo do mínimo', async () => {
      mockPrisma.stockItem.findMany.mockResolvedValue([
        { ...itemBase, quantidade: 5, quantidadeMinima: 10, validade: null },
        { ...itemBase, id: 'item-2', quantidade: 50, quantidadeMinima: 10, validade: null },
      ]);

      const resultado = await service.alertas();

      expect(resultado.stockMinimo).toHaveLength(1);
      expect(resultado.stockMinimo[0].id).toBe('item-1');
    });

    it('identifica itens com validade próxima (<= 30 dias)', async () => {
      const em10Dias = new Date(); em10Dias.setDate(em10Dias.getDate() + 10);
      mockPrisma.stockItem.findMany.mockResolvedValue([
        { ...itemBase, validade: em10Dias },
      ]);

      const resultado = await service.alertas();

      expect(resultado.validadeProxima).toHaveLength(1);
    });
  });
});
