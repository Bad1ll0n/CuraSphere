import { Test, TestingModule } from '@nestjs/testing';
import { AtribuicoesService } from './atribuicoes.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  horarioTurno: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  atribuicaoHorarioTurno: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

const turnoBase = {
  id: 'turno-1', nome: 'Manhã', inicio: new Date(), fim: new Date(),
  utilizadores: [{ utilizadorId: 'enf-1', chefeEquipa: true, utilizador: { id: 'enf-1', nome: 'Enf. Ana', role: 'enfermeiro' } }],
  atribuicoes: [],
};

describe('AtribuicoesService', () => {
  let service: AtribuicoesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuicoesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AtribuicoesService>(AtribuicoesService);
  });

  describe('turnoAtivo()', () => {
    it('devolve turno activo', async () => {
      mockPrisma.horarioTurno.findFirst.mockResolvedValue(turnoBase);

      const resultado = await service.turnoAtivo();

      expect(resultado!.id).toBe('turno-1');
    });

    it('devolve null quando não há turno activo', async () => {
      mockPrisma.horarioTurno.findFirst.mockResolvedValue(null);

      const resultado = await service.turnoAtivo();

      expect(resultado).toBeNull();
    });
  });

  describe('buscarTurno()', () => {
    it('devolve turno pelo ID', async () => {
      mockPrisma.horarioTurno.findUnique.mockResolvedValue(turnoBase);

      const resultado = await service.buscarTurno('turno-1');

      expect((resultado as any).nome).toBe('Manhã');
    });
  });

  describe('chefeDeTurno()', () => {
    it('devolve id do profissional com menor ordemExperiencia no grupo', () => {
      const turno = {
        profissionais: [{ utilizador: { id: 'enf-1', role: 'enfermeiro', ordemExperiencia: 1 } }],
      };

      const resultado = service.chefeDeTurno(turno as any, ['enfermeiro']);

      expect(resultado).toBe('enf-1');
    });

    it('devolve null quando não há profissional no grupo pedido', () => {
      const turno = {
        profissionais: [{ utilizador: { id: 'enf-1', role: 'enfermeiro', ordemExperiencia: 1 } }],
      };

      const resultado = service.chefeDeTurno(turno as any, ['medico']);

      expect(resultado).toBeNull();
    });
  });

  describe('turnosDoDia()', () => {
    it('devolve turnos do dia', async () => {
      mockPrisma.horarioTurno.findMany.mockResolvedValue([turnoBase]);

      const resultado = await service.turnosDoDia();

      expect(resultado).toHaveLength(1);
    });
  });
});
