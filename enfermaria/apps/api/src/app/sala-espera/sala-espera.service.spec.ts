import { Test, TestingModule } from '@nestjs/testing';
import { SalaEsperaService } from './sala-espera.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  checkinSalaEspera: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
};

const checkinBase = {
  id: 'c1', nomeDoente: 'Ana', estado: 'aguardando', prioridade: 'normal',
  motivo: 'Consulta', registadoEm: new Date(),
};

describe('SalaEsperaService', () => {
  let service: SalaEsperaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.checkinSalaEspera.findMany.mockResolvedValue([]);
    mockPrisma.checkinSalaEspera.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaEsperaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalaEsperaService>(SalaEsperaService);
  });

  describe('registar()', () => {
    it('cria checkin na sala de espera', async () => {
      mockPrisma.checkinSalaEspera.create.mockResolvedValue(checkinBase);

      const resultado = await service.registar(
        { nomeDoente: 'Ana', motivo: 'Consulta' },
        'recep-1',
      );

      expect(resultado.nomeDoente).toBe('Ana');
      expect(mockPrisma.checkinSalaEspera.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('listar()', () => {
    it('devolve lista de checkins activos', async () => {
      mockPrisma.checkinSalaEspera.findMany.mockResolvedValue([checkinBase]);

      const resultado = await service.listar();

      expect(resultado).toHaveLength(1);
    });
  });

  describe('chamar()', () => {
    it('actualiza estado para em_atendimento', async () => {
      mockPrisma.checkinSalaEspera.findUnique.mockResolvedValue(checkinBase);
      mockPrisma.checkinSalaEspera.update.mockResolvedValue({ ...checkinBase, estado: 'em_atendimento' });

      const resultado = await service.chamar('c1', 'medico-1');

      expect(resultado.estado).toBe('em_atendimento');
    });
  });

  describe('concluir()', () => {
    it('marca checkin como atendido', async () => {
      mockPrisma.checkinSalaEspera.findUnique?.mockResolvedValue(checkinBase);
      mockPrisma.checkinSalaEspera.update.mockResolvedValue({ ...checkinBase, estado: 'atendido' });

      const resultado = await service.concluir('c1', 'atendido');

      expect(resultado.estado).toBe('atendido');
    });
  });

  describe('estatisticas()', () => {
    it('devolve contagens de estado', async () => {
      mockPrisma.checkinSalaEspera.count
        .mockResolvedValueOnce(5)  // aguardando
        .mockResolvedValueOnce(2)  // em_atendimento
        .mockResolvedValueOnce(10); // atendidos
      mockPrisma.checkinSalaEspera.findMany.mockResolvedValue([]);

      const resultado = await service.estatisticas();

      expect(resultado.aguardando).toBe(5);
      expect(resultado.em_atendimento).toBe(2);
      expect(resultado.atendidos).toBe(10);
      expect(resultado.tempoMedioMin).toBeNull();
    });
  });
});
