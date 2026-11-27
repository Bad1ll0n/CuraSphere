import { Test, TestingModule } from '@nestjs/testing';
import { AtribuicoesService } from './atribuicoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockNotificacoes = { enviarParaUtilizadores: jest.fn().mockResolvedValue(undefined) };

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
        { provide: NotificacoesService, useValue: mockNotificacoes },
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

  describe('pedirAtribuicao() — UX-10', () => {
    it('avisa a chefia ativa, sem devolver dados do doente a quem pede', async () => {
      (mockPrisma as any).doente = { findUnique: jest.fn().mockResolvedValue({ id: 'd1', nome: 'Maria', cama: { numero: '12' } }) };
      (mockPrisma as any).utilizador = {
        ...(mockPrisma as any).utilizador,
        findUnique: jest.fn().mockResolvedValue({ nome: 'Enf. Rui' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
      };
      const r = await service.pedirAtribuicao('d1', 'u1', 'Doente do meu quarto');
      expect(r).toEqual({ enviado: true, destinatarios: 2 });
      expect(mockNotificacoes.enviarParaUtilizadores).toHaveBeenCalledWith(['c1', 'c2'], 'Pedido de atribuição', expect.stringMatching(/Enf\. Rui pede para ser atribuído a Maria \(cama 12\)/), expect.objectContaining({ doenteId: 'd1', nivel: 'aviso' }));
    });
  });
});
