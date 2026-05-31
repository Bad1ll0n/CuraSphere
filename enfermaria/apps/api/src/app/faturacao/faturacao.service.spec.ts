import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FaturacaoService } from './faturacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: { findUnique: jest.fn() },
  episodioFaturacao: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  itemFatura: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  pagamento: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

describe('FaturacaoService', () => {
  let service: FaturacaoService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaturacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<FaturacaoService>(FaturacaoService);
  });

  // ── resumo() ─────────────────────────────────────────────────────────────────

  describe('resumo()', () => {
    it('agrega correctamente totalFaturado, totalPago e totalPendente', async () => {
      mockPrisma.episodioFaturacao.findMany.mockResolvedValue([
        { id: '1', estado: 'paga',     totalCobrado: 500, itens: [], pagamentos: [], doente: {} },
        { id: '2', estado: 'emitida',  totalCobrado: 300, itens: [], pagamentos: [], doente: {} },
        { id: '3', estado: 'pendente', totalCobrado: 200, itens: [], pagamentos: [], doente: {} },
        { id: '4', estado: 'anulada',  totalCobrado: 100, itens: [], pagamentos: [], doente: {} },
      ]);

      const { stats } = await service.resumo();

      expect(stats.totalFaturado).toBe(1000); // exclui anulados: 500+300+200
      expect(stats.totalPago).toBe(500);
      expect(stats.totalPendente).toBe(500); // emitida + pendente: 300+200
      expect(stats.totalAnulado).toBe(100);
    });

    it('countPorEstado reflecte a contagem de episódios por estado', async () => {
      mockPrisma.episodioFaturacao.findMany.mockResolvedValue([
        { id: '1', estado: 'paga',    totalCobrado: 100, itens: [], pagamentos: [], doente: {} },
        { id: '2', estado: 'paga',    totalCobrado: 100, itens: [], pagamentos: [], doente: {} },
        { id: '3', estado: 'emitida', totalCobrado: 50,  itens: [], pagamentos: [], doente: {} },
      ]);

      const { stats } = await service.resumo();

      expect(stats.countPorEstado['paga']).toBe(2);
      expect(stats.countPorEstado['emitida']).toBe(1);
    });

    it('devolve stats zeradas quando não há episódios', async () => {
      mockPrisma.episodioFaturacao.findMany.mockResolvedValue([]);

      const { stats } = await service.resumo();

      expect(stats.totalFaturado).toBe(0);
      expect(stats.totalPago).toBe(0);
      expect(stats.countPorEstado).toEqual({});
    });
  });

  // ── registarPagamento() ──────────────────────────────────────────────────────

  describe('registarPagamento()', () => {
    const dadosPagamento = {
      valor: 200,
      metodo: 'transferencia',
      registadoPorId: 'admin-1',
    };

    it('lança NotFoundException quando episódio não existe', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue(null);

      await expect(service.registarPagamento('ep-x', dadosPagamento)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando episódio está anulado', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({
        id: 'ep-1', estado: 'anulada', totalCobrado: 300,
      });

      await expect(service.registarPagamento('ep-1', dadosPagamento)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando episódio já está pago', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({
        id: 'ep-1', estado: 'paga', totalCobrado: 300,
      });

      await expect(service.registarPagamento('ep-1', dadosPagamento)).rejects.toThrow(BadRequestException);
    });

    it('regista pagamento parcial sem alterar estado', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({
        id: 'ep-1', estado: 'emitida', totalCobrado: 500,
      });
      const pagamentoCriado = { id: 'pag-1', valor: 200, registadoPor: {} };
      mockPrisma.pagamento.create.mockResolvedValue(pagamentoCriado);
      // totalPago = 200 < 500 → não marca como paga
      mockPrisma.pagamento.findMany.mockResolvedValue([{ valor: 200 }]);

      const resultado = await service.registarPagamento('ep-1', dadosPagamento);

      expect(resultado.id).toBe('pag-1');
      expect(mockPrisma.episodioFaturacao.update).not.toHaveBeenCalled();
    });

    it('muda estado para paga quando totalPago >= totalCobrado', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({
        id: 'ep-1', estado: 'emitida', totalCobrado: 200,
      });
      mockPrisma.pagamento.create.mockResolvedValue({ id: 'pag-1', valor: 200, registadoPor: {} });
      mockPrisma.pagamento.findMany.mockResolvedValue([{ valor: 200 }]);
      mockPrisma.episodioFaturacao.update.mockResolvedValue({ id: 'ep-1', estado: 'paga' });

      await service.registarPagamento('ep-1', dadosPagamento);

      expect(mockPrisma.episodioFaturacao.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ep-1' }, data: { estado: 'paga' } }),
      );
    });
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criar({ doenteId: 'doente-x', criadoPorId: 'admin-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria episódio de faturação para doente existente', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Ana' });
      const ep = { id: 'ep-1', doenteId: 'doente-1', doente: { id: 'doente-1', nome: 'Ana' }, criadoPor: {} };
      mockPrisma.episodioFaturacao.create.mockResolvedValue(ep);

      const resultado = await service.criar({ doenteId: 'doente-1', criadoPorId: 'admin-1' });

      expect(resultado.id).toBe('ep-1');
    });
  });

  // ── adicionarItem() ───────────────────────────────────────────────────────────

  describe('adicionarItem()', () => {
    it('lança NotFoundException quando episódio não existe', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue(null);

      await expect(
        service.adicionarItem('ep-x', { descricao: 'Consulta', categoria: 'consulta', precoUnitario: 50 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando episódio está pago', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({ id: 'ep-1', estado: 'paga' });

      await expect(
        service.adicionarItem('ep-1', { descricao: 'Consulta', categoria: 'consulta', precoUnitario: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calcula total = quantidade × precoUnitario', async () => {
      mockPrisma.episodioFaturacao.findUnique.mockResolvedValue({ id: 'ep-1', estado: 'emitida' });
      mockPrisma.itemFatura.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'item-1', ...data }),
      );
      mockPrisma.itemFatura.findMany.mockResolvedValue([{ total: 150 }]);
      mockPrisma.episodioFaturacao.update.mockResolvedValue({});

      await service.adicionarItem('ep-1', {
        descricao: 'Análise',
        categoria: 'laboratorio',
        quantidade: 3,
        precoUnitario: 50,
      });

      const criado = mockPrisma.itemFatura.create.mock.calls[0][0];
      expect(criado.data.total).toBe(150);
    });
  });
});
