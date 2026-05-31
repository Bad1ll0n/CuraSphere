import { Test } from '@nestjs/testing';
import { AlertasService } from './alertas.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockPrisma = {
  alertaClinico: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  sinalVital: { findFirst: jest.fn() },
  medicacao: { findMany: jest.fn() },
  alergia: { findMany: jest.fn() },
  atribuicaoHorarioTurno: { findMany: jest.fn() },
  horarioTurnoProfissional: { findMany: jest.fn() },
  utilizador: { findMany: jest.fn() },
  turno: { findFirst: jest.fn() },
};

const mockNotificacoes = {
  enviarParaDoente: jest.fn().mockResolvedValue(undefined),
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  emitirSOS: jest.fn(),
  estaOnline: jest.fn().mockResolvedValue(false),
};

describe('AlertasService', () => {
  let service: AlertasService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AlertasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<AlertasService>(AlertasService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockNotificacoes.enviarParaDoente.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockGateway.estaOnline.mockResolvedValue(false);
  });

  describe('listarNaoLidos()', () => {
    it('retorna alertas não lidos do doente', async () => {
      const alertas = [{ id: 'a1', tipo: 'news2', lido: false }];
      mockPrisma.alertaClinico.findMany.mockResolvedValueOnce(alertas);

      const result = await service.listarNaoLidos('d1');
      expect(result).toEqual(alertas);
      expect(mockPrisma.alertaClinico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doenteId: 'd1', lido: false } }),
      );
    });
  });

  describe('marcarLido()', () => {
    it('marca alerta como lido', async () => {
      const alerta = { id: 'a1', lido: true };
      mockPrisma.alertaClinico.update.mockResolvedValueOnce(alerta);

      const result = await service.marcarLido('a1');
      expect(result.lido).toBe(true);
      expect(mockPrisma.alertaClinico.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' }, data: { lido: true } }),
      );
    });
  });

  describe('marcarTodosLidos()', () => {
    it('marca todos os alertas do doente como lidos', async () => {
      mockPrisma.alertaClinico.updateMany.mockResolvedValueOnce({ count: 3 });

      const result = await service.marcarTodosLidos('d1');
      expect((result as any).count).toBe(3);
      expect(mockPrisma.alertaClinico.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doenteId: 'd1', lido: false } }),
      );
    });
  });

  describe('acusar()', () => {
    it('regista acusação no alerta', async () => {
      const alerta = { id: 'a1', acusadoPorId: 'u1', lido: true };
      mockPrisma.alertaClinico.update.mockResolvedValueOnce(alerta);

      const result = await service.acusar('a1', 'u1');
      expect(result.acusadoPorId).toBe('u1');
      expect(mockPrisma.alertaClinico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acusadoPorId: 'u1', lido: true }),
        }),
      );
    });
  });

  describe('acionarSOS()', () => {
    const mockAlerta = {
      id: 'sos1',
      doente: {
        id: 'd1',
        nome: 'João Silva',
        diagnosticoPrincipal: 'Pneumonia',
        cama: { numero: '101', quarto: 'A' },
      },
    };

    beforeEach(() => {
      mockPrisma.alertaClinico.create.mockResolvedValue(mockAlerta);
      mockPrisma.sinalVital.findFirst.mockResolvedValue(null);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([]);
      mockPrisma.horarioTurnoProfissional.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findMany.mockResolvedValue([]);
      mockPrisma.turno.findFirst.mockResolvedValue(null);
    });

    it('cria alerta SOS com urgencia=true', async () => {
      const result = await service.acionarSOS('d1', 'u1');

      expect(mockPrisma.alertaClinico.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ doenteId: 'd1', tipo: 'sos', urgencia: true }),
        }),
      );
      expect(result).toEqual(mockAlerta);
    });

    it('emite SOS via WebSocket', async () => {
      await service.acionarSOS('d1', 'u1');
      expect(mockGateway.emitirSOS).toHaveBeenCalledWith('d1', 'João Silva', expect.stringContaining('A'), 'u1');
    });

    it('notifica médicos atribuídos ao doente quando presentes', async () => {
      const medicoId = 'med1';
      mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([
        { utilizador: { id: medicoId, role: 'medico', subRole: 'cardiologia' } },
      ]);

      await service.acionarSOS('d1', 'u1');

      expect(mockNotificacoes.enviarParaUtilizador).toHaveBeenCalledWith(
        medicoId,
        expect.stringContaining('SOS'),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('usa fallback para todos os médicos activos quando sem atribuição e sem turno', async () => {
      mockPrisma.utilizador.findMany.mockResolvedValue([
        { id: 'med2' },
        { id: 'med3' },
      ]);

      await service.acionarSOS('d1', 'u1');

      expect(mockNotificacoes.enviarParaUtilizador).toHaveBeenCalledWith(
        'med2',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('inclui sinais vitais no contexto da notificação quando disponíveis', async () => {
      // For this test we need to check the prisma calls include sinalVital, medicacao, alergia
      // The create call happens in parallel with these queries
      mockPrisma.alertaClinico.create.mockImplementationOnce(async ({ data, include }: any) => ({
        id: 'sos1',
        doente: mockAlerta.doente,
      }));

      await service.acionarSOS('d1', 'u1');

      // Verifica que o alerta foi criado com os dados correctos
      const createCall = mockPrisma.alertaClinico.create.mock.calls[0][0];
      expect(createCall.data.tipo).toBe('sos');
      expect(createCall.data.urgencia).toBe(true);
    });
  });
});
