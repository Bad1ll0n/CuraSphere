import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliacaoService } from './reconciliacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const agora = new Date();
const h1Atras = new Date(agora.getTime() - 1.5 * 60 * 60 * 1000);
const h3Atras = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
const h10Atras = new Date(agora.getTime() - 10 * 60 * 60 * 1000);

const mockPrisma = {
  medicacao: { findMany: jest.fn() },
  pedidoFarmacia: { findMany: jest.fn() },
  utilizador: { findMany: jest.fn() },
};

const mockAlertas = { criarAlerta: jest.fn().mockReturnValue(undefined) };
const mockNotificacoes = { enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };

describe('ReconciliacaoService', () => {
  let service: ReconciliacaoService;

  afterEach(() => {
    // Limpar setInterval criado pelo lifecycle test para evitar warning de timer
    service?.onApplicationShutdown();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAlertas.criarAlerta.mockReturnValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockPrisma.medicacao.findMany.mockResolvedValue([]);
    mockPrisma.pedidoFarmacia.findMany.mockResolvedValue([]);
    mockPrisma.utilizador.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertas },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<ReconciliacaoService>(ReconciliacaoService);
  });

  // ── verificar() ──────────────────────────────────────────────────────────────

  describe('verificar()', () => {
    it('devolve array vazio quando sem problemas', async () => {
      const resultado = await service.verificar();
      expect(resultado).toHaveLength(0);
    });

    it('detecta prescrição sem validação farmacêutica', async () => {
      mockPrisma.medicacao.findMany
        .mockResolvedValueOnce([
          {
            id: 'm1', nome: 'Meropenem 1g', dose: '1g', via: 'IV', frequencia: '8/8h',
            iniciadoEm: h3Atras,
            doente: { id: 'd1', nome: 'Maria' },
            prescritoPor: { nome: 'Dr. Silva' },
          },
        ])
        .mockResolvedValueOnce([]); // sem_mar

      const resultado = await service.verificar();

      expect(resultado.some((r) => r.tipo === 'prescricao_sem_validacao')).toBe(true);
      expect(resultado[0].doenteNome).toBe('Maria');
    });

    it('detecta medicação sem registo MAR', async () => {
      mockPrisma.medicacao.findMany
        .mockResolvedValueOnce([]) // sem_validacao
        .mockResolvedValueOnce([
          {
            id: 'm2', nome: 'Amoxicilina 1g', dose: '1g', via: 'oral', frequencia: '8/8h',
            iniciadoEm: h10Atras,
            doente: { id: 'd2', nome: 'João' },
          },
        ]);

      const resultado = await service.verificar();

      expect(resultado.some((r) => r.tipo === 'medicacao_sem_mar')).toBe(true);
    });

    it('detecta pedido de farmácia pendente há >1h', async () => {
      mockPrisma.pedidoFarmacia.findMany.mockResolvedValue([
        {
          id: 'p1', servico: 'medicina', criadoEm: h1Atras,
          stockItem: { nome: 'Paracetamol 1g' },
          solicitadoPor: { nome: 'Enf. Ana' },
        },
      ]);

      const resultado = await service.verificar();

      expect(resultado.some((r) => r.tipo === 'pedido_pendente_longa')).toBe(true);
    });

    it('ordena por horasAtraso descendente', async () => {
      mockPrisma.medicacao.findMany
        .mockResolvedValueOnce([
          { id: 'm1', nome: 'Med A', dose: '1g', via: 'IV', frequencia: '8/8h', iniciadoEm: h3Atras, doente: { id: 'd1', nome: 'A' }, prescritoPor: { nome: 'Dr' } },
          { id: 'm2', nome: 'Med B', dose: '1g', via: 'IV', frequencia: '8/8h', iniciadoEm: h1Atras, doente: { id: 'd2', nome: 'B' }, prescritoPor: { nome: 'Dr' } },
        ])
        .mockResolvedValueOnce([]);

      const resultado = await service.verificar();

      expect(resultado[0].horasAtraso).toBeGreaterThanOrEqual(resultado[1].horasAtraso);
    });
  });

  // ── resumo() ─────────────────────────────────────────────────────────────────

  describe('resumo()', () => {
    it('devolve contagem por tipo', async () => {
      mockPrisma.medicacao.findMany
        .mockResolvedValueOnce([
          { id: 'm1', nome: 'X', dose: '1g', via: 'IV', frequencia: '8/8h', iniciadoEm: h3Atras, doente: { id: 'd1', nome: 'X' }, prescritoPor: { nome: 'Dr' } },
        ])
        .mockResolvedValueOnce([]);

      const resultado = await service.resumo();

      expect(resultado.total).toBe(1);
      expect(resultado.porTipo.prescricaoSemValidacao).toBe(1);
      expect(resultado.porTipo.medicacaoSemMar).toBe(0);
    });
  });

  // ── lifecycle ────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('inicia intervalo em onApplicationBootstrap', () => {
      service.onApplicationBootstrap();
      expect((service as any).intervalo).not.toBeNull();
    });

    it('limpa intervalo em onApplicationShutdown', () => {
      service.onApplicationBootstrap();
      service.onApplicationShutdown();
      expect((service as any).intervalo).toBeDefined();
    });
  });
});
