import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FarmaciaService } from './farmacia.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockTx = {
  pedidoFarmacia: { findUnique: jest.fn(), update: jest.fn() },
  stockItem: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  transferenciaStock: { create: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
  ajusteStock: { create: jest.fn() },
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

      expect(resultado!.quantidade).toBe(60);
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

  // ── confirmarTransferencia() ────────────────────────────────

  const transfBase = {
    id: 'tr-1',
    stockItemId: 'item-1',
    quantidade: 10,
    servicoOrigem: 'medicina',
    servicoDestino: 'cirurgia',
    estado: 'pendente',
    confirmadoPorId: null,
  };

  describe('confirmarTransferencia()', () => {
    it('lança NotFoundException quando transferência não existe', async () => {
      mockTx.transferenciaStock.findUnique.mockResolvedValue(null);
      await expect(service.confirmarTransferencia('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando já foi processada', async () => {
      mockTx.transferenciaStock.findUnique.mockResolvedValue({ ...transfBase, estado: 'confirmada', stockItem: itemBase });
      await expect(service.confirmarTransferencia('tr-1', 'u1')).rejects.toThrow(BadRequestException);
      expect(mockTx.stockItem.updateMany).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando o stock de origem não chega', async () => {
      mockTx.transferenciaStock.findUnique.mockResolvedValue({ ...transfBase, quantidade: 999, stockItem: { ...itemBase, quantidade: 5 } });
      await expect(service.confirmarTransferencia('tr-1', 'u1')).rejects.toThrow(BadRequestException);
      expect(mockTx.stockItem.updateMany).not.toHaveBeenCalled();
    });

    it('fecha a transferência com o estado esperado no `where` antes de mexer em stock', async () => {
      mockTx.transferenciaStock.findUnique.mockResolvedValue({ ...transfBase, stockItem: itemBase });
      mockTx.transferenciaStock.updateMany.mockResolvedValue({ count: 1 });
      mockTx.stockItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.stockItem.findFirst.mockResolvedValue({ id: 'item-2', servico: 'cirurgia' });
      mockTx.stockItem.update.mockResolvedValue({});
      mockTx.ajusteStock.create.mockResolvedValue({});

      await service.confirmarTransferencia('tr-1', 'u1');

      expect(mockTx.transferenciaStock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tr-1', estado: 'pendente' } }),
      );
      expect(mockTx.stockItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-1', quantidade: { gte: 10 } } }),
      );
    });

    it('aborta sem debitar stock quando o fecho de estado perde a corrida (count 0)', async () => {
      mockTx.transferenciaStock.findUnique.mockResolvedValue({ ...transfBase, stockItem: itemBase });
      mockTx.transferenciaStock.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmarTransferencia('tr-1', 'u1')).rejects.toThrow(BadRequestException);
      expect(mockTx.stockItem.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── confirmarTransferencia() — concorrência ──────────────────────

  describe('confirmarTransferencia() — concorrência', () => {
    // Duplo do Prisma com estado real em memória. `updateMany` avalia o `where` e
    // aplica a mutação sem `await` pelo meio — modela o lock de linha de um
    // `UPDATE ... WHERE estado = 'pendente'`. As leituras cedem o event loop, para
    // que os N pedidos se cruzem de facto entre a leitura-guarda e a escrita.
    function criarPrismaEmMemoria(quantidadeInicial: number) {
      const ceder = () => new Promise((r) => setImmediate(r));
      const db = {
        transferencia: { ...transfBase } as any,
        itens: [{ ...itemBase, id: 'item-1', quantidade: quantidadeInicial, tipo: 'medicamento', catalogoId: null, precoUnitario: 1 }] as any[],
        ajustes: [] as any[],
      };

      const tx = {
        transferenciaStock: {
          findUnique: async ({ where, include }: any) => {
            await ceder();
            if (where.id !== db.transferencia.id) return null;
            const base: any = { ...db.transferencia };
            if (include?.stockItem) base.stockItem = { ...db.itens.find((i) => i.id === db.transferencia.stockItemId) };
            return base;
          },
          findUniqueOrThrow: async () => ({ ...db.transferencia }),
          updateMany: async ({ where, data }: any) => {
            if (where.id !== db.transferencia.id || db.transferencia.estado !== where.estado) return { count: 0 };
            Object.assign(db.transferencia, data);
            return { count: 1 };
          },
        },
        stockItem: {
          updateMany: async ({ where, data }: any) => {
            const item = db.itens.find((i) => i.id === where.id);
            if (!item) return { count: 0 };
            if (where.quantidade?.gte !== undefined && item.quantidade < where.quantidade.gte) return { count: 0 };
            if (data.quantidade?.decrement) item.quantidade -= data.quantidade.decrement;
            if (data.quantidade?.increment) item.quantidade += data.quantidade.increment;
            return { count: 1 };
          },
          findFirst: async ({ where }: any) => {
            await ceder();
            return db.itens.find((i) => i.nome === where.nome && i.servico === where.servico) ?? null;
          },
          update: async ({ where, data }: any) => {
            const item = db.itens.find((i) => i.id === where.id);
            if (data.quantidade?.increment) item.quantidade += data.quantidade.increment;
            if (data.quantidade?.decrement) item.quantidade -= data.quantidade.decrement;
            return item;
          },
          create: async ({ data }: any) => {
            const novo = { id: `item-${db.itens.length + 1}`, ...data };
            db.itens.push(novo);
            return novo;
          },
        },
        ajusteStock: { create: async ({ data }: any) => { db.ajustes.push(data); return data; } },
      };

      return { db, prisma: { $transaction: (fn: any) => fn(tx) } };
    }

    it('com 8 pedidos em paralelo só um vence e o stock é debitado uma única vez', async () => {
      const { db, prisma } = criarPrismaEmMemoria(100);
      const svc = new FarmaciaService(prisma as any, mockNotificacoes as any);

      const N = 8;
      const resultados = await Promise.allSettled(
        Array.from({ length: N }, (_, i) => svc.confirmarTransferencia('tr-1', `u${i}`)),
      );

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        resultados.filter((r) => r.status === 'rejected' && (r as PromiseRejectedResult).reason instanceof BadRequestException),
      ).toHaveLength(N - 1);

      // 100 − 10, uma única vez — não 100 − (8 × 10)
      expect(db.itens.find((i) => i.id === 'item-1').quantidade).toBe(90);
      expect(db.transferencia.estado).toBe('confirmada');
      expect(db.ajustes.filter((a) => a.delta === -10)).toHaveLength(1);
      expect(db.ajustes.filter((a) => a.delta === 10)).toHaveLength(1);
      // o destino recebeu exactamente uma vez
      expect(db.itens.filter((i) => i.servico === 'cirurgia')).toHaveLength(1);
      expect(db.itens.find((i) => i.servico === 'cirurgia').quantidade).toBe(10);
    });

    it('confirmar e cancelar em paralelo — exactamente um dos dois vence', async () => {
      const { db, prisma } = criarPrismaEmMemoria(100);
      const svc = new FarmaciaService(prisma as any, mockNotificacoes as any);

      const resultados = await Promise.allSettled([
        svc.confirmarTransferencia('tr-1', 'u1'),
        svc.cancelarTransferencia('tr-1'),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(['confirmada', 'cancelada']).toContain(db.transferencia.estado);
      // se cancelou, o stock não pode ter sido tocado
      if (db.transferencia.estado === 'cancelada') {
        expect(db.itens.find((i) => i.id === 'item-1').quantidade).toBe(100);
      } else {
        expect(db.itens.find((i) => i.id === 'item-1').quantidade).toBe(90);
      }
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
