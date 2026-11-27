import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { HorariosService } from './horarios.service';
import { PrismaService } from '../prisma/prisma.service';
import { DotacoesService } from '../dotacoes/dotacoes.service';
import { PARAMETROS_REFERENCIA } from '../dotacoes/dotacoes.regras';

const mockPrisma = {
  $transaction: jest.fn(),
  escala: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  horarioTurno: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
  horarioTurnoProfissional: { deleteMany: jest.fn(), createMany: jest.fn() },
  atribuicaoHorarioTurno: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  ausencia: { findMany: jest.fn() },
  utilizador: { findMany: jest.fn() },
};

const escalaBase = { id: 'esc-1', mes: 6, ano: 2026, turnos: [] };
const mockDotacoes = { parametros: jest.fn() };

describe('HorariosService', () => {
  let service: HorariosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });
    mockPrisma.escala.findMany.mockResolvedValue([]);
    mockPrisma.ausencia.findMany.mockResolvedValue([]);
    mockPrisma.utilizador.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [HorariosService, { provide: PrismaService, useValue: mockPrisma }, { provide: DotacoesService, useValue: mockDotacoes }],
    }).compile();
    service = module.get<HorariosService>(HorariosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve escalas paginadas', async () => {
      mockPrisma.escala.findMany.mockResolvedValue([escalaBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });

  // ── buscarPorMes() ────────────────────────────────────────────────────────────

  describe('buscarPorMes()', () => {
    it('lança NotFoundException quando escala não existe', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorMes(13, 2026)).rejects.toThrow(NotFoundException);
    });

    it('devolve escala quando existe', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(escalaBase);

      const resultado = await service.buscarPorMes(6, 2026);

      expect(resultado).toMatchObject({ mes: 6, ano: 2026 });
    });
  });

  // ── criar() ───────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança ConflictException quando escala já existe', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(escalaBase);

      await expect(service.criar({ mes: 6, ano: 2026, criadaPorId: 'user-1' })).rejects.toThrow(ConflictException);
    });

    it('cria escala quando não existe conflito', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(null);
      mockPrisma.escala.create.mockResolvedValue({ ...escalaBase, criadaPor: { id: 'user-1', nome: 'Admin' } });

      const resultado = await service.criar({ mes: 6, ano: 2026, criadaPorId: 'user-1' });

      expect(mockPrisma.escala.create).toHaveBeenCalled();
      expect(resultado).toMatchObject({ mes: 6, ano: 2026 });
    });
  });

  // ── adicionarTurno() ──────────────────────────────────────────────────────────

  describe('adicionarTurno()', () => {
    const dadosTurno = {
      escalId: 'esc-1',
      tipo: 'manha' as any,
      data: new Date('2026-06-15'),
      profissionaisIds: ['prof-1'],
    };

    it('lança BadRequestException quando profissional está em ausência', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(escalaBase);
      mockPrisma.ausencia.findMany.mockResolvedValue([{
        utilizadorId: 'prof-1', utilizador: { nome: 'Enfermeira Ana' },
      }]);

      await expect(service.adicionarTurno(dadosTurno)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando turno já existe nesse dia', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(escalaBase);
      mockPrisma.ausencia.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findMany.mockResolvedValue([{ role: 'enfermeiro' }]);
      mockPrisma.horarioTurno.findFirst.mockResolvedValue({ id: 'turno-existente' });

      await expect(service.adicionarTurno(dadosTurno)).rejects.toThrow(BadRequestException);
    });

    it('cria turno quando não existem conflitos', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(escalaBase);
      mockPrisma.ausencia.findMany.mockResolvedValue([]);
      mockPrisma.utilizador.findMany.mockResolvedValue([{ role: 'enfermeiro' }]);
      mockPrisma.horarioTurno.findFirst.mockResolvedValue(null);
      mockPrisma.horarioTurno.create.mockResolvedValue({
        id: 'turno-1', tipo: 'manha', profissionais: [],
      });

      const resultado = await service.adicionarTurno(dadosTurno);

      expect(mockPrisma.horarioTurno.create).toHaveBeenCalled();
      expect(resultado).toHaveProperty('id', 'turno-1');
    });
  });

  // ── gerarEscalaAutomatica() — PROD-17 ───────────────────────────────────────

  describe('gerarEscalaAutomatica() — por serviço (PROD-17)', () => {
    const minimos = (enfermeiro: number) => ({ enfermeiro, auxiliar: 0, medico: 0 });
    beforeEach(() => {
      mockDotacoes.parametros.mockResolvedValue({ ...PARAMETROS_REFERENCIA, minimos: { manha: minimos(1), tarde: minimos(1), noite: minimos(1) } });
      mockPrisma.horarioTurno.findMany.mockResolvedValue([]);
      mockPrisma.horarioTurno.create.mockResolvedValue({});
    });

    it('a escala é do serviço (mes+ano+servico) e o pessoal é o colocado nele', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue(null);
      mockPrisma.escala.create.mockResolvedValue({ id: 'esc-med', mes: 2, ano: 2027, servico: 'Medicina A' });
      mockPrisma.utilizador.findMany.mockResolvedValue([{ id: 'e1', role: 'enfermeiro', competencias: [] }, { id: 'e2', role: 'enfermeiro', competencias: [] }, { id: 'e3', role: 'enfermeiro', competencias: [] }, { id: 'e4', role: 'enfermeiro', competencias: [] }, { id: 'e5', role: 'enfermeiro', competencias: [] }, { id: 'e6', role: 'enfermeiro', competencias: [] }]);
      const r = await service.gerarEscalaAutomatica(2, 2027, 'chefe', 'Medicina A');
      expect(mockPrisma.escala.findUnique).toHaveBeenCalledWith({ where: { mes_ano_servico: { mes: 2, ano: 2027, servico: 'Medicina A' } } });
      expect(mockPrisma.utilizador.findMany.mock.calls[0][0].where).toMatchObject({ unidade: 'Medicina A' });
      expect(mockDotacoes.parametros).toHaveBeenCalledWith('Medicina A');
      expect(r).toMatchObject({ turnosCriados: 28 * 3, diasGerados: 28, escala: { servico: 'Medicina A' } });
      expect(r.faltas).toEqual([]);
    });

    it('serviço sem pessoal colocado → erro que diz o que fazer', async () => {
      mockPrisma.escala.findUnique.mockResolvedValue({ id: 'esc-x' });
      mockPrisma.utilizador.findMany.mockResolvedValue([]);
      await expect(service.gerarEscalaAutomatica(2, 2027, 'chefe', 'Cirurgia')).rejects.toThrow(/defina a unidade/);
    });
  });

  // ── editarTurno() ─────────────────────────────────────────────────────────────

  describe('editarTurno()', () => {
    it('lança NotFoundException quando turno não existe', async () => {
      mockPrisma.horarioTurno.findUnique.mockResolvedValue(null);

      await expect(service.editarTurno('turno-x', { tipo: 'tarde' as any })).rejects.toThrow(NotFoundException);
    });
  });
});
