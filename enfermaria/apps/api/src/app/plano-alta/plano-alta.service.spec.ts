import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAltaService } from './plano-alta.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
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
