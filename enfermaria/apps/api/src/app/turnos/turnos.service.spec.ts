import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { PrismaService } from '../prisma/prisma.service';
import { TarefasService } from '../tarefas/tarefas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

// ── Turno de referência ───────────────────────────────────────────────────────

const mockTurno = {
  id: 't1',
  tipo: 'manha',
  dataInicio: new Date(),
  dataFim: new Date(),
  chefeTurnoId: 'chef1',
};

// ── Mock PrismaService ────────────────────────────────────────────────────────

const mockPrisma = {
  turno: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  horarioEntrada: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  horarioTurnoProfissional: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  registoCheckin: {
    create: jest.fn().mockResolvedValue({}),
  },
  utilizador: {
    findUnique: jest.fn(),
  },
  atribuicaoDoente: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  passagemTurno: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  notaTurno: {
    create: jest.fn(),
  },
  auditLog: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ── Mock dependências ─────────────────────────────────────────────────────────

const mockTarefas = {
  transitarParaTurno: jest.fn().mockResolvedValue(undefined),
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  estaOnline: jest.fn().mockResolvedValue(false),
  emitirSOS: jest.fn(),
  emitirPassagemDesafio: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('TurnosService', () => {
  let service: TurnosService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Restaurar mocks que precisam de valor padrão após reset
    mockPrisma.registoCheckin.create.mockResolvedValue({});
    mockTarefas.transitarParaTurno.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockGateway.estaOnline.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TarefasService, useValue: mockTarefas },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<TurnosService>(TurnosService);
  });

  // ── checkIn() ───────────────────────────────────────────────────────────────

  describe('checkIn()', () => {
    it('lança BadRequestException quando não existe turno ativo', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(null);

      await expect(service.checkIn('user1')).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando o utilizador já fez check-in no turno', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(mockTurno);
      mockPrisma.horarioEntrada.findUnique.mockResolvedValue({ id: 'entrada-existente' });

      await expect(service.checkIn('user1')).rejects.toThrow(BadRequestException);
    });

    it('lança ForbiddenException quando o utilizador não está escalado para o turno', async () => {
      mockPrisma.turno.findFirst.mockResolvedValue(mockTurno);
      mockPrisma.horarioEntrada.findUnique.mockResolvedValue(null);
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue(null);

      await expect(service.checkIn('user1')).rejects.toThrow(ForbiddenException);
    });

    it('faz check-in com sucesso e retorna { entrada, passagem, dentroGeofence: true }', async () => {
      // turnoAtivo() — findFirst com include complexo
      mockPrisma.turno.findFirst.mockResolvedValue(mockTurno);
      // sem check-in anterior
      mockPrisma.horarioEntrada.findUnique.mockResolvedValue(null);
      // utilizador escalado
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ id: 'h1' });
      // criar registo de entrada
      mockPrisma.horarioEntrada.create.mockResolvedValue({ id: 'e1' });

      // gerarPassagemTurno: turno.findUnique devolve o turno atual
      mockPrisma.turno.findUnique.mockResolvedValue(mockTurno);
      // sem turno anterior → gerarPassagemTurno devolve null imediatamente
      // Nota: turno.findFirst já foi usado para turnoAtivo(); a segunda chamada
      // dentro de gerarPassagemTurno também passa por findFirst
      mockPrisma.turno.findFirst
        .mockResolvedValueOnce(mockTurno)  // turnoAtivo()
        .mockResolvedValueOnce(null);       // turno anterior (nenhum)

      // sem atribuições de doentes
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);

      const resultado = await service.checkIn('user1');

      expect(mockPrisma.horarioEntrada.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { turnoId: 't1', utilizadorId: 'user1' } }),
      );
      expect(resultado).toMatchObject({ entrada: { id: 'e1' }, dentroGeofence: true });
    });

    it('IP externo define dentroGeofence: false e notifica o chefe de turno', async () => {
      mockPrisma.turno.findFirst
        .mockResolvedValueOnce(mockTurno)  // turnoAtivo()
        .mockResolvedValueOnce(null);       // turno anterior em gerarPassagemTurno
      mockPrisma.horarioEntrada.findUnique.mockResolvedValue(null);
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ id: 'h1' });
      mockPrisma.horarioEntrada.create.mockResolvedValue({ id: 'e2' });
      mockPrisma.turno.findUnique.mockResolvedValue(mockTurno);
      mockPrisma.atribuicaoDoente.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findUnique.mockResolvedValue({ nome: 'Enfermeiro Externo' });

      const resultado = await service.checkIn('user1', { ip: '8.8.8.8' });

      expect(resultado.dentroGeofence).toBe(false);
      expect(mockNotificacoes.enviarParaUtilizador).toHaveBeenCalledWith(
        mockTurno.chefeTurnoId,
        expect.any(String),
        expect.stringContaining('IP externo'),
        expect.any(Object),
      );
    });
  });

  // ── atribuirDoentes() ───────────────────────────────────────────────────────

  describe('atribuirDoentes()', () => {
    it('executa $transaction com deleteMany + createMany para o turnoId fornecido', async () => {
      const atribuicoes = [
        { doenteId: 'd1', enfermeiroId: 'enf1' },
        { doenteId: 'd2', enfermeiroId: 'enf2' },
      ];

      // Simular comportamento real do $transaction com array
      mockPrisma.$transaction.mockImplementation((arg: unknown) => {
        if (typeof arg === 'function') return arg(mockPrisma);
        return Promise.all(arg as Promise<unknown>[]);
      });

      // deleteMany e createMany precisam de devolver algo para Promise.all funcionar
      mockPrisma.atribuicaoDoente.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.atribuicaoDoente.createMany.mockResolvedValue({ count: 2 });

      await service.atribuirDoentes('t1', atribuicoes);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── adicionarNota() ──────────────────────────────────────────────────────────

  describe('adicionarNota()', () => {
    it('cria nota de turno com os dados fornecidos', async () => {
      const notaData = {
        turnoId: 't1',
        doenteId: 'd1',
        autorId: 'user1',
        texto: 'Doente estável, sem intercorrências.',
      };
      const notaCriada = { id: 'nota1', ...notaData, autor: { id: 'user1', nome: 'Ana', role: 'enfermeiro' } };

      mockPrisma.notaTurno.create.mockResolvedValue(notaCriada);

      const resultado = await service.adicionarNota(notaData);

      expect(mockPrisma.notaTurno.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: notaData }),
      );
      expect(resultado).toEqual(notaCriada);
    });
  });
});
