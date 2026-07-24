import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  ticket: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const ticketBase = { id: 't1', numero: 'A001', tipo: 'consulta', estado: 'aguarda', balcao: null, prioridade: 'normal' };

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.ticket.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('tirarSenha()', () => {
    it('cria ticket e devolve número de senha', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.ticket.create.mockResolvedValue(ticketBase);

      const resultado = await service.tirarSenha({ tipo: 'consulta' });

      expect(resultado.numero).toBe('A001');
      expect(mockPrisma.ticket.create).toHaveBeenCalledTimes(1);
    });

    it('gera número com prioridade alta em caso de urgência', async () => {
      mockPrisma.ticket.count.mockResolvedValue(3);
      mockPrisma.ticket.create.mockResolvedValue({ ...ticketBase, numero: 'P004', prioridade: 10 });

      const resultado = await service.tirarSenha({ tipo: 'urgencia', prioridade: 10 } as any);

      expect(resultado.numero).toBe('P004');
    });
  });

  describe('chamarProximo()', () => {
    it('devolve null quando fila está vazia', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);

      const resultado = await service.chamarProximo('Balcão 1');

      expect(resultado).toBeNull();
    });

    it('actualiza ticket chamado para estado em_atendimento', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketBase);
      mockPrisma.ticket.update.mockResolvedValue({ ...ticketBase, estado: 'em_atendimento', balcao: 'Balcão 1' });

      const resultado = await service.chamarProximo('Balcão 1');

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'chamado', balcao: 'Balcão 1' }) }),
      );
      expect(resultado!.estado).toBe('em_atendimento');
    });
  });

  describe('listarFila()', () => {
    it('devolve tickets em espera', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([ticketBase]);

      const resultado = await service.listarFila();

      expect(resultado).toHaveLength(1);
    });
  });
});
