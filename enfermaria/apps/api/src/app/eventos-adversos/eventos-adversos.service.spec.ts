import { Test, TestingModule } from '@nestjs/testing';
import { EventosAdversosService } from './eventos-adversos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  eventoAdverso: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
};

const eventoBase = {
  id: 'ev-1', tipo: 'queda', gravidade: 'moderada', descricao: 'Queda do leito',
  estado: 'aberto', registadoPorId: 'enf-1', ocorridoEm: new Date(),
};

describe('EventosAdversosService', () => {
  let service: EventosAdversosService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventosAdversosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EventosAdversosService>(EventosAdversosService);
  });

  describe('criar()', () => {
    it('regista evento adverso', async () => {
      mockPrisma.eventoAdverso.create.mockResolvedValue(eventoBase);

      const resultado = await service.criar(
        { tipo: 'queda', gravidade: 'moderada', descricao: 'Queda do leito' },
        'enf-1',
      );

      expect(resultado.tipo).toBe('queda');
    });
  });

  describe('listar()', () => {
    it('devolve eventos filtrados', async () => {
      mockPrisma.eventoAdverso.findMany.mockResolvedValue([eventoBase]);

      const resultado = await service.listar({ tipo: 'queda' });

      expect(resultado).toHaveLength(1);
    });

    it('devolve todos os eventos sem filtros', async () => {
      mockPrisma.eventoAdverso.findMany.mockResolvedValue([eventoBase]);

      const resultado = await service.listar({});

      expect(resultado).toHaveLength(1);
    });
  });

  describe('atualizar()', () => {
    it('actualiza ação corretiva e estado', async () => {
      mockPrisma.eventoAdverso.findUnique.mockResolvedValue(eventoBase);
      mockPrisma.eventoAdverso.update.mockResolvedValue({ ...eventoBase, estado: 'em_analise' });

      const resultado = await service.atualizar('ev-1', { estado: 'em_analise', acaoCorretiva: 'Grades levantadas' });

      expect(resultado.estado).toBe('em_analise');
    });
  });
});
