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
    updateMany: jest.fn(),
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

    it('PROD-18: deduz a classe ICPS do tipo e, se anónimo, não guarda o autor', async () => {
      mockPrisma.eventoAdverso.create.mockResolvedValue(eventoBase);
      await service.criar({ tipo: 'queda', gravidade: 'dano_leve', descricao: 'Queda', anonimo: true }, 'enf-1');
      expect(mockPrisma.eventoAdverso.create.mock.calls[0][0].data).toMatchObject({ classeIcps: 'acidente_doente', anonimo: true, registadoPorId: null });
    });

    it('PROD-18: classe ICPS desconhecida é recusada', async () => {
      await expect(service.criar({ tipo: 'outro', gravidade: 'sem_dano', descricao: 'x', classeIcps: 'xpto' }, 'enf-1')).rejects.toThrow(/ICPS/);
    });
  });

  describe('exportarNotifica() — PROD-18', () => {
    const ev = { id: 'e1', tipo: 'queda', gravidade: 'dano_moderado', descricao: 'Queda', servicoId: 'internamento', acaoCorretiva: null, ocorridoEm: new Date('2026-11-10T03:00:00Z'), classeIcps: null };
    it('anónimo, com ICPS; só marca como exportado quando pedido', async () => {
      mockPrisma.eventoAdverso.findMany.mockResolvedValue([ev]);
      const r = await service.exportarNotifica({ inicio: '2026-11-01', fim: '2026-12-01' });
      expect(r).toMatchObject({ formato: 'NOTIFICA/ICPS', total: 1, incidentes: [{ tipoIncidenteIcps: 'acidente_doente', grauDano: 'moderado' }] });
      expect(mockPrisma.eventoAdverso.updateMany).not.toHaveBeenCalled();
      await service.exportarNotifica({ inicio: '2026-11-01', fim: '2026-12-01', soNovos: true, marcar: true });
      expect(mockPrisma.eventoAdverso.findMany.mock.calls[1][0].where).toMatchObject({ exportadoNotificaEm: null });
      expect(mockPrisma.eventoAdverso.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['e1'] } }, data: { exportadoNotificaEm: expect.any(Date) } });
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
