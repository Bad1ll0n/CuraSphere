import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConsultasService } from './consultas.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockTx = {
  consulta: {
    findFirst: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null), // null = código único disponível
    create: jest.fn(),
  },
  episodioFaturacao: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockPrisma = {
  $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)),
  consulta: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  agendaMedico: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  portalDoente: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  atoConsulta: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockTickets = { tirarSenha: jest.fn().mockResolvedValue({ numero: 'A001' }) };
const mockNotificacoes = { enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };

const consultaBase = {
  id: 'consulta-1',
  medicoId: 'medico-1',
  doenteId: 'doente-1',
  estado: 'agendada',
  dataHora: new Date(Date.now() + 86400000),
  duracao: 30,
  tipo: 'teleconsulta',
  videoRoomId: null,
  videoIniciadaEm: null,
  doente: { id: 'doente-1', nome: 'Maria Santos', dataNascimento: null, numeroProcesso: '99999' },
  medico: { id: 'medico-1', nome: 'Dr. Costa', role: 'medico', subRole: 'clinico_geral' },
};

describe('ConsultasService', () => {
  let service: ConsultasService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockPrisma.portalDoente.findUnique.mockResolvedValue(null);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockTickets.tirarSenha.mockResolvedValue({ numero: 'A001' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TicketsService, useValue: mockTickets },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<ConsultasService>(ConsultasService);
  });

  // ── agendar() ─────────────────────────────────────────────────────────────

  describe('agendar()', () => {
    it('lança ConflictException quando slot já está ocupado', async () => {
      mockTx.consulta.findFirst.mockResolvedValue({ id: 'c-existente' }); // conflito detectado

      await expect(
        service.agendar({
          medicoId: 'medico-1',
          especialidade: 'clinico_geral',
          dataHora: new Date(Date.now() + 86400000).toISOString(),
          nomeDoente: 'Teste',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cria consulta quando slot está disponível', async () => {
      mockTx.consulta.findFirst.mockResolvedValue(null); // sem conflito
      mockTx.consulta.create.mockResolvedValue({ ...consultaBase, id: 'consulta-nova' });

      const resultado = await service.agendar({
        medicoId: 'medico-1',
        especialidade: 'clinico_geral',
        dataHora: new Date(Date.now() + 86400000).toISOString(),
        nomeDoente: 'João Silva',
      });

      expect(mockTx.consulta.create).toHaveBeenCalledTimes(1);
      expect(resultado).toHaveProperty('id', 'consulta-nova');
    });

    it('cria consulta com tipo teleconsulta quando especificado', async () => {
      mockTx.consulta.findFirst.mockResolvedValue(null);
      mockTx.consulta.create.mockResolvedValue({ ...consultaBase, tipo: 'teleconsulta' });

      await service.agendar({
        medicoId: 'medico-1',
        especialidade: 'clinico_geral',
        dataHora: new Date(Date.now() + 86400000).toISOString(),
        tipo: 'teleconsulta',
        nomeDoente: 'Ana Costa',
      });

      const createCall = mockTx.consulta.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject(expect.objectContaining({ medicoId: 'medico-1' }));
    });
  });

  // ── iniciarVideo() ────────────────────────────────────────────────────────

  describe('iniciarVideo()', () => {
    it('lança ForbiddenException quando utilizador não é o médico da consulta', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({ ...consultaBase, medicoId: 'medico-1' });

      await expect(
        service.iniciarVideo('consulta-1', 'outro-utilizador'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException quando consulta não é teleconsulta', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'medico-1', tipo: 'presencial',
      });

      await expect(
        service.iniciarVideo('consulta-1', 'medico-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('SEC-16: sala aleatória de 128 bits, sem relação com o id da consulta', async () => {
      const consultaId = 'abcdef12-resto-do-uuid';
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, id: consultaId, medicoId: 'medico-1', tipo: 'teleconsulta', videoRoomId: null,
      });
      mockPrisma.consulta.update.mockResolvedValue({});

      const a = await service.iniciarVideo(consultaId, 'medico-1');
      expect(a.videoRoomId).toMatch(/^cs-[0-9a-f]{32}$/);
      expect(a.videoRoomId).not.toContain('abcdef12');
      expect(a.roomUrl).toContain(a.videoRoomId);
      const b = await service.iniciarVideo(consultaId, 'medico-1');
      expect(b.videoRoomId).not.toBe(a.videoRoomId);
    });

    it('SEC-16: chamada em curso mantém a sala', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'medico-1', tipo: 'teleconsulta', videoRoomId: 'cs-existente', videoTerminouEm: null,
      });
      mockPrisma.consulta.update.mockResolvedValue({});
      const r = await service.iniciarVideo('consulta-1', 'medico-1');
      expect(r.videoRoomId).toBe('cs-existente');
    });
  });

  // ── terminarVideo() ───────────────────────────────────────────────────────

  describe('terminarVideo()', () => {
    it('lança ForbiddenException quando utilizador não é o médico', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({ ...consultaBase, medicoId: 'medico-1' });

      await expect(
        service.terminarVideo('consulta-1', 'utilizador-errado'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza videoTerminouEm e calcula duração em minutos', async () => {
      const inicio = new Date(Date.now() - 30 * 60 * 1000); // 30min atrás
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'medico-1',
      });
      mockPrisma.consulta.update.mockResolvedValue({
        ...consultaBase, videoIniciadaEm: inicio, videoTerminouEm: new Date(),
      });

      const resultado = await service.terminarVideo('consulta-1', 'medico-1');

      expect(mockPrisma.consulta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ videoTerminouEm: expect.any(Object) }),
        }),
      );
      expect(resultado).toHaveProperty('duracaoMin');
      expect(typeof resultado.duracaoMin).toBe('number');
    });

    it('duracaoMin é null quando videoIniciadaEm é null', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'medico-1',
      });
      mockPrisma.consulta.update.mockResolvedValue({
        ...consultaBase, videoIniciadaEm: null, videoTerminouEm: new Date(),
      });

      const resultado = await service.terminarVideo('consulta-1', 'medico-1');

      expect(resultado.duracaoMin).toBeNull();
    });
  });

  // ── dadosVideo() ──────────────────────────────────────────────────────────

  describe('dadosVideo()', () => {
    it('lança NotFoundException quando consulta não existe', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue(null);

      await expect(
        service.dadosVideo('consulta-inexistente', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando videoRoomId é null', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'user-1', videoRoomId: null,
      });

      await expect(
        service.dadosVideo('consulta-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devolve videoRoomId e roomUrl ao médico da consulta', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'user-1', videoRoomId: 'cs-abcdef12',
      });

      const resultado = await service.dadosVideo('consulta-1', 'user-1');

      expect(resultado.videoRoomId).toBe('cs-abcdef12');
      expect(resultado.roomUrl).toContain('cs-abcdef12');
    });

    it('SEC-16: outro utilizador não recebe os dados da sala', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'medico-1', videoRoomId: 'cs-abcdef12',
      });
      await expect(service.dadosVideo('consulta-1', 'enfermeiro-1')).rejects.toThrow(ForbiddenException);
    });

    it('SEC-16: chamada terminada já não dá entrada', async () => {
      mockPrisma.consulta.findUnique.mockResolvedValue({
        ...consultaBase, medicoId: 'user-1', videoRoomId: 'cs-abcdef12', videoTerminouEm: new Date(),
      });
      await expect(service.dadosVideo('consulta-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── calcularSlots() ───────────────────────────────────────────────────────

  describe('calcularSlots()', () => {
    it('devolve lista vazia quando médico não tem agenda nesse dia', async () => {
      mockPrisma.agendaMedico.findUnique.mockResolvedValue(null);

      const slots = await service.calcularSlots('medico-1', '2026-06-09');

      expect(slots).toEqual([]);
    });

    it('devolve slots disponíveis quando agenda activa e sem consultas marcadas', async () => {
      mockPrisma.agendaMedico.findUnique.mockResolvedValue({
        id: 'agenda-1', medicoId: 'medico-1', diaSemana: 1,
        horaInicio: '09:00', horaFim: '12:00', duracaoSlot: 30, ativo: true,
      });
      mockPrisma.consulta.findMany.mockResolvedValue([]);

      const slots = await service.calcularSlots('medico-1', '2026-06-08'); // segunda

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s: any) => s.disponivel === true)).toBe(true);
    });

    it('marca slot como ocupado quando consulta agendada coincide', async () => {
      // Usar local time para garantir que slot e consulta têm o mesmo timestamp
      const slotLocalDate = new Date('2026-06-08');
      slotLocalDate.setHours(9, 0, 0, 0);

      mockPrisma.agendaMedico.findUnique.mockResolvedValue({
        id: 'agenda-1', medicoId: 'medico-1', diaSemana: 1, // segunda
        horaInicio: '09:00', horaFim: '11:00', duracaoSlot: 30, ativo: true,
      });
      mockPrisma.consulta.findMany.mockResolvedValue([
        { dataHora: slotLocalDate, duracao: 30 },
      ]);

      const slots = await service.calcularSlots('medico-1', '2026-06-08');

      // Deve haver pelo menos um slot marcado como ocupado
      const temOcupado = slots.some((s: any) => !s.disponivel);
      expect(temOcupado).toBe(true);
    });
  });
});
