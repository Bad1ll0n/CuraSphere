import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BlocoService } from './bloco.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockPrisma = {
  $transaction: jest.fn(),
  cirurgiaProgramada: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  checklistCirurgia: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  episodioFaturacao: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  atoClinico: { findFirst: jest.fn() },
  itemFatura: { create: jest.fn() },
};

const mockGateway = { emitirBlocoUpdate: jest.fn(), server: { emit: jest.fn() } };

const cirurgiaBase = {
  id: 'cir-1', doenteId: 'd1', designacao: 'Apendicectomia', sala: 'Sala 1',
  estado: 'agendada', dataHora: new Date('2026-06-10T09:00:00Z'), duracaoPrevista: 90,
  doente: { id: 'd1', nome: 'Ana' }, cirurgiao: { id: 'u1', nome: 'Dr. Pereira' },
};

describe('BlocoService', () => {
  let service: BlocoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma));
    mockPrisma.episodioFaturacao.findFirst.mockResolvedValue({ id: 'ep-1' }); // já existe → skip auto-faturação
    mockGateway.emitirBlocoUpdate.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<BlocoService>(BlocoService);
  });

  // ── agendar() ────────────────────────────────────────────────────────────────

  describe('agendar()', () => {
    it('cria cirurgia e devolve registo', async () => {
      mockPrisma.cirurgiaProgramada.create.mockResolvedValue(cirurgiaBase);

      const resultado = await service.agendar({
        doenteId: 'd1', designacao: 'Apendicectomia',
        dataHora: '2026-06-10T09:00:00Z', duracaoPrevista: 90,
        sala: 'Sala 1', cirurgiaoId: 'u1',
      });

      expect(resultado.id).toBe('cir-1');
      expect(mockPrisma.cirurgiaProgramada.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── detalhe() ────────────────────────────────────────────────────────────────

  describe('detalhe()', () => {
    it('lança NotFoundException quando cirurgia não existe', async () => {
      mockPrisma.cirurgiaProgramada.findUnique.mockResolvedValue(null);
      await expect(service.detalhe('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve cirurgia quando encontrada', async () => {
      mockPrisma.cirurgiaProgramada.findUnique.mockResolvedValue(cirurgiaBase);
      const resultado = await service.detalhe('cir-1');
      expect(resultado.id).toBe('cir-1');
    });
  });

  // ── atualizarEstado() ────────────────────────────────────────────────────────

  describe('atualizarEstado()', () => {
    it('actualiza estado e emite evento via gateway', async () => {
      mockPrisma.cirurgiaProgramada.findUnique.mockResolvedValue(cirurgiaBase);
      mockPrisma.cirurgiaProgramada.update.mockResolvedValue({ ...cirurgiaBase, estado: 'em_curso' });

      await service.atualizarEstado('cir-1', 'em_curso');

      expect(mockGateway.emitirBlocoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ cirurgiaId: 'cir-1', estado: 'em_curso' }),
      );
    });
  });

  // ── agenda() ─────────────────────────────────────────────────────────────────

  describe('agenda()', () => {
    it('devolve cirurgias do dia', async () => {
      mockPrisma.cirurgiaProgramada.findMany.mockResolvedValue([cirurgiaBase]);
      const resultado = await service.agenda('2026-06-10');
      expect(resultado).toHaveLength(1);
    });

    it('devolve lista vazia quando sem cirurgias', async () => {
      mockPrisma.cirurgiaProgramada.findMany.mockResolvedValue([]);
      const resultado = await service.agenda();
      expect(resultado).toHaveLength(0);
    });
  });

  // ── agendaMes() ──────────────────────────────────────────────────────────────

  describe('agendaMes()', () => {
    it('agrupa cirurgias por dia', async () => {
      const d1 = { ...cirurgiaBase, dataHora: new Date('2026-06-10T09:00:00Z') };
      const d2 = { ...cirurgiaBase, id: 'cir-2', dataHora: new Date('2026-06-10T14:00:00Z') };
      mockPrisma.cirurgiaProgramada.findMany.mockResolvedValue([d1, d2]);

      const resultado = await service.agendaMes(6, 2026);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].total).toBe(2);
    });
  });

  // ── obterChecklist() ─────────────────────────────────────────────────────────

  describe('obterChecklist()', () => {
    it('devolve checklist existente', async () => {
      mockPrisma.cirurgiaProgramada.findUnique.mockResolvedValue(cirurgiaBase);
      const checklist = { cirurgiaId: 'cir-1', signInEm: new Date() };
      mockPrisma.checklistCirurgia.findUnique.mockResolvedValue(checklist);

      const resultado = await service.obterChecklist('cir-1');
      expect(resultado.cirurgiaId).toBe('cir-1');
    });

    it('devolve checklist vazia quando não existe', async () => {
      mockPrisma.cirurgiaProgramada.findUnique.mockResolvedValue(cirurgiaBase);
      mockPrisma.checklistCirurgia.findUnique.mockResolvedValue(null);

      const resultado = await service.obterChecklist('cir-1');
      expect(resultado.signInEm).toBeNull();
    });
  });
});
