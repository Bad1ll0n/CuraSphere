import { Test, TestingModule } from '@nestjs/testing';
import { NotificacoesService } from './notificacoes.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  dispositivoToken: { upsert: jest.fn(), findMany: jest.fn() },
  notificacaoInApp: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  utilizador: { findMany: jest.fn() },
  atribuicaoDoente: { findMany: jest.fn() },
};

describe('NotificacoesService', () => {
  let service: NotificacoesService;
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dispositivoToken.findMany.mockResolvedValue([]);
    mockPrisma.notificacaoInApp.create.mockResolvedValue({ id: 'n-1' });
    mockPrisma.notificacaoInApp.findMany.mockResolvedValue([]);
    mockPrisma.notificacaoInApp.count.mockResolvedValue(0);

    // Mock global fetch before each test so circuit breaker state is fresh
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificacoesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<NotificacoesService>(NotificacoesService);
  });

  it('é definido', () => expect(service).toBeDefined());

  // ── registarToken() ───────────────────────────────────────────────────────────

  describe('registarToken()', () => {
    it('regista token de dispositivo', async () => {
      mockPrisma.dispositivoToken.upsert.mockResolvedValue({ id: 'dt-1', token: 'expo-tok', utilizadorId: 'u1' });
      const r = await service.registarToken('u1', 'expo-tok', 'android');
      expect(r.token).toBe('expo-tok');
    });
  });

  // ── enviarParaUtilizador() ────────────────────────────────────────────────────

  describe('enviarParaUtilizador()', () => {
    it('persiste notificação in-app', async () => {
      await service.enviarParaUtilizador('u1', 'Título', 'Corpo', {});
      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalled();
    });

    it('não falha quando utilizador não tem dispositivos', async () => {
      mockPrisma.dispositivoToken.findMany.mockResolvedValue([]);
      await expect(service.enviarParaUtilizador('u1', 'T', 'C')).resolves.not.toThrow();
    });

    it('invoca fetch quando existem dispositivos', async () => {
      mockPrisma.dispositivoToken.findMany.mockResolvedValue([
        { token: 'expo-push-token-1', utilizadorId: 'u1' },
      ]);

      await service.enviarParaUtilizador('u1', 'Título', 'Corpo');
      await Promise.resolve();
      await Promise.resolve();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('exp.host'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('não propaga excepção quando fetch rejeita (fire-and-forget)', async () => {
      mockPrisma.dispositivoToken.findMany.mockResolvedValue([
        { token: 'expo-push-token-1', utilizadorId: 'u1' },
      ]);
      mockFetch.mockRejectedValue(new Error('network error'));

      await expect(service.enviarParaUtilizador('u1', 'T', 'C')).resolves.toBeUndefined();
    });
  });

  // ── circuit breaker ───────────────────────────────────────────────────────────

  describe('circuit breaker', () => {
    it('não invoca fetch após 3 falhas consecutivas', async () => {
      mockPrisma.dispositivoToken.findMany.mockResolvedValue([
        { token: 'expo-push-token-1', utilizadorId: 'u1' },
      ]);
      mockFetch.mockRejectedValue(new Error('network error'));

      // 3 chamadas que devem acumular falhas e abrir o circuit breaker
      for (let i = 0; i < 3; i++) {
        await service.enviarParaUtilizador('u1', 'T', 'C');
        await Promise.resolve();
        await Promise.resolve();
      }

      const callsAposAbertura = mockFetch.mock.calls.length; // deve ser 3

      // 4ª chamada — circuit breaker aberto → fetch NÃO chamado novamente
      mockFetch.mockResolvedValue({ ok: true });
      await service.enviarParaUtilizador('u1', 'T', 'C');
      await Promise.resolve();

      expect(mockFetch.mock.calls.length).toBe(callsAposAbertura);
    });
  });

  // ── listar() ──────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('devolve total, naoLidas e notificacoes', async () => {
      mockPrisma.notificacaoInApp.count
        .mockResolvedValueOnce(5)   // total (via Promise.all)
        .mockResolvedValueOnce(2);  // naoLidas
      mockPrisma.notificacaoInApp.findMany.mockResolvedValue([{ id: 'n-1' }, { id: 'n-2' }]);

      const resultado = await service.listar('u1');

      expect(resultado).toMatchObject({ total: 5, naoLidas: 2 });
      expect(resultado.notificacoes).toHaveLength(2);
    });
  });

  // ── marcarLida() ──────────────────────────────────────────────────────────────

  describe('marcarLida()', () => {
    it('chama updateMany com lida=true e lidaEm', async () => {
      mockPrisma.notificacaoInApp.updateMany.mockResolvedValue({ count: 1 });

      await service.marcarLida('notif-1', 'u1');

      expect(mockPrisma.notificacaoInApp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1', utilizadorId: 'u1' },
          data: expect.objectContaining({ lida: true, lidaEm: expect.any(Date) }),
        }),
      );
    });
  });

  // ── enviarParaRole() ──────────────────────────────────────────────────────────

  describe('enviarParaRole()', () => {
    it('consulta utilizadores por role e envia notificação para cada um', async () => {
      mockPrisma.utilizador.findMany.mockResolvedValue([
        { id: 'u1' }, { id: 'u2' },
      ]);

      await service.enviarParaRole('enfermeiro', 'Título', 'Corpo');

      expect(mockPrisma.utilizador.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'enfermeiro', ativo: true } }),
      );
      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalledTimes(2);
    });
  });
});
