import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAltaService } from './plano-alta.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  episodioInternamento: { findFirst: jest.fn() },
  planoAlta: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const planoBase = {
  id: 'pa-1', doenteId: 'd1', dataAlvoDia: null, notas: null,
  afebrилApenas24h: false, mobilidadeAdequada: false, alimentacaoOral: false,
  doresControladas: false, familiaInformada: false,
};

describe('PlanoAltaService', () => {
  let service: PlanoAltaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep-1', estado: 'ativo' });
    mockPrisma.planoAlta.upsert.mockResolvedValue(planoBase);
    mockPrisma.planoAlta.findUnique.mockResolvedValue(planoBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanoAltaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlanoAltaService>(PlanoAltaService);
  });

  describe('buscar()', () => {
    it('devolve plano existente', async () => {
      const resultado = await service.buscar('d1');

      expect(resultado!.doenteId).toBe('d1');
    });
  });

  describe('PROD-02 — plano por episódio', () => {
    it('lê/cria o plano do episódio em curso', async () => {
      await service.buscar('d1');
      expect(mockPrisma.planoAlta.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { episodioId: 'ep-1' }, create: { doenteId: 'd1', episodioId: 'ep-1' },
      }));
    });
    it('doente que nunca esteve internado: sem plano (null)', async () => {
      mockPrisma.episodioInternamento.findFirst.mockResolvedValue(null);
      expect(await service.buscar('d1')).toBeNull();
    });
    it('depois da alta o plano já não se altera', async () => {
      mockPrisma.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep-1', estado: 'alta' });
      await expect(service.atualizar('d1', { mobilidadeAdequada: true })).rejects.toThrow(/internamento em curso/);
    });
  });

  describe('atualizar()', () => {
    it('actualiza critérios de alta', async () => {
      mockPrisma.planoAlta.upsert.mockResolvedValue(planoBase);
      mockPrisma.planoAlta.update.mockResolvedValue({ ...planoBase, mobilidadeAdequada: true });

      const resultado = await service.atualizar('d1', { mobilidadeAdequada: true });

      expect(resultado.mobilidadeAdequada).toBe(true);
    });
  });

  describe('calcularProgresso()', () => {
    it('calcula progresso com critérios cumpridos', async () => {
      const plano = { ...planoBase, afebrилApenas24h: true, mobilidadeAdequada: true };

      const resultado = await service.calcularProgresso(plano);

      expect(resultado.cumpridos).toBe(2);
      expect(resultado.total).toBeGreaterThan(0);
    });

    it('devolve 0 cumpridos quando nenhum critério satisfeito', async () => {
      const resultado = await service.calcularProgresso(planoBase);
      expect(resultado.cumpridos).toBe(0);
    });
  });
});
