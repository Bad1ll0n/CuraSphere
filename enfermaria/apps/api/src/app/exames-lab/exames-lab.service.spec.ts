import { Test, TestingModule } from '@nestjs/testing';
import { ExamesLabService } from './exames-lab.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  resultadoAnalise: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockEmit = jest.fn();
const mockGateway = { server: { to: jest.fn().mockReturnValue({ emit: mockEmit }) } };

const resultadoBase = {
  id: 'res-1', doenteId: 'd1', painel: 'hemograma', parametro: 'Hemoglobina',
  valor: '12.5', unidade: 'g/dL', critico: false, registadoPorId: 'enf-1',
};

describe('ExamesLabService', () => {
  let service: ExamesLabService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    mockGateway.server.to.mockReturnValue({ emit: mockEmit });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamesLabService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ExamesLabService>(ExamesLabService);
  });

  describe('criar()', () => {
    it('cria resultado de análise', async () => {
      mockPrisma.resultadoAnalise.create.mockResolvedValue(resultadoBase);

      const resultado = await service.criar(
        { doenteId: 'd1', painel: 'hemograma', parametro: 'Hemoglobina', valor: 12.5, unidade: 'g/dL' },
        'enf-1',
      );

      expect(resultado.parametro).toBe('Hemoglobina');
    });

    it('emite evento crítico quando resultado é crítico', async () => {
      const resultadoCritico = { ...resultadoBase, critico: true };
      mockPrisma.resultadoAnalise.create.mockResolvedValue(resultadoCritico);

      await service.criar(
        { doenteId: 'd1', painel: 'hemograma', parametro: 'Potássio', valor: 7.2, unidade: 'mEq/L', critico: true },
        'enf-1',
      );

      expect(mockGateway.server.to).toHaveBeenCalledWith('doente:d1');
      expect(mockEmit).toHaveBeenCalledWith('resultado-critico', expect.any(Object));
    });
  });

  describe('listarPorDoente()', () => {
    it('devolve resultados do doente', async () => {
      mockPrisma.resultadoAnalise.findMany.mockResolvedValue([resultadoBase]);

      const resultado = await service.listarPorDoente('d1');

      expect(resultado).toHaveLength(1);
    });

    it('filtra por painel quando fornecido', async () => {
      mockPrisma.resultadoAnalise.findMany.mockResolvedValue([resultadoBase]);

      await service.listarPorDoente('d1', 'hemograma');

      expect(mockPrisma.resultadoAnalise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ painel: 'hemograma' }) }),
      );
    });
  });

  describe('criarLote()', () => {
    it('cria múltiplos resultados em lote', async () => {
      mockPrisma.resultadoAnalise.create
        .mockResolvedValueOnce(resultadoBase)
        .mockResolvedValueOnce({ ...resultadoBase, id: 'res-2', parametro: 'Hematócrito' });

      const resultados = await service.criarLote(
        [
          { doenteId: 'd1', painel: 'hemograma', parametro: 'Hemoglobina', valor: 12.5, unidade: 'g/dL' },
          { doenteId: 'd1', painel: 'hemograma', parametro: 'Hematócrito', valor: 38, unidade: '%' },
        ],
        'enf-1',
      );

      expect(resultados).toHaveLength(2);
    });
  });
});
