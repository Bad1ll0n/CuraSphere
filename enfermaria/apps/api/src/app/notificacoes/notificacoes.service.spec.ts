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
  atribuicaoHorarioTurno: { findMany: jest.fn() },
  turno: { findFirst: jest.fn() },
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
    mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);
    mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([]);
    mockPrisma.turno.findFirst.mockResolvedValue(null);
    mockPrisma.utilizador.findMany.mockResolvedValue([]);

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

  // ── enviarParaDoente() — BA-04(a) destinatários ───────────────────────────────

  describe('enviarParaDoente()', () => {
    const turnoAberto = { id: 'turno-1', chefeTurnoId: 'chefe-1' };

    /** Última chamada a utilizador.findMany é sempre o filtro de "activos". */
    const mockAtivos = (ids: string[]) =>
      mockPrisma.utilizador.findMany.mockResolvedValue(ids.map((id) => ({ id })));

    it('notifica os enfermeiros atribuídos no turno em curso', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(turnoAberto);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([{ enfermeiroId: 'enf-1' }]);
      mockAtivos(['enf-1']);

      await service.enviarParaDoente('d1', 'T', 'C');

      expect(mockPrisma.atribuicaoDoente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doenteId: 'd1', turnoId: 'turno-1' } }),
      );
      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ utilizadorId: 'enf-1' }) }),
      );
    });

    it('inclui o médico responsável do turno (antes nunca era notificado)', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(turnoAberto);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([{ enfermeiroId: 'enf-1' }]);
      mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([
        { utilizador: { id: 'med-1', role: 'medico' } },
        { utilizador: { id: 'aux-1', role: 'auxiliar' } },
      ]);
      mockAtivos(['enf-1', 'med-1']);

      await service.enviarParaDoente('d1', 'T', 'C');

      const notificados = mockPrisma.notificacaoInApp.create.mock.calls.map(
        (c: [{ data: { utilizadorId: string } }]) => c[0].data.utilizadorId,
      );
      expect(notificados).toEqual(expect.arrayContaining(['enf-1', 'med-1']));
      expect(notificados).not.toContain('aux-1');
    });

    it('doente sem atribuição cai no chefe de turno (antes: zero destinatários)', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(turnoAberto);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);
      mockAtivos(['chefe-1']);

      await service.enviarParaDoente('d1', 'T', 'C');

      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ utilizadorId: 'chefe-1' }) }),
      );
    });

    it('sem turno aberto nem atribuições, recorre à chefia de serviço', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(null);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findMany
        .mockResolvedValueOnce([{ id: 'chefe-enf' }]) // chefias
        .mockResolvedValueOnce([{ id: 'chefe-enf' }]); // filtro de activos

      await service.enviarParaDoente('d1', 'T', 'C');

      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ utilizadorId: 'chefe-enf' }) }),
      );
    });

    it('exclui utilizadores desactivados', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(turnoAberto);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([
        { enfermeiroId: 'enf-activo' }, { enfermeiroId: 'enf-inactivo' },
      ]);
      mockAtivos(['enf-activo']);

      await service.enviarParaDoente('d1', 'T', 'C');

      const notificados = mockPrisma.notificacaoInApp.create.mock.calls.map(
        (c: [{ data: { utilizadorId: string } }]) => c[0].data.utilizadorId,
      );
      expect(notificados).toEqual(['enf-activo']);
    });

    it('não rebenta quando não há mesmo nenhum destinatário', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(null);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findMany.mockResolvedValue([]);

      await expect(service.enviarParaDoente('d1', 'T', 'C')).resolves.toBeUndefined();
      expect(mockPrisma.notificacaoInApp.create).not.toHaveBeenCalled();
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
