import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StewardshipService } from './stewardship.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ content: [{ text: 'Sugestão de de-escalação.' }] }) },
  })),
}));

const mockPrisma = {
  stewardshipAntibiotico: {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  resultadoAnalise: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('StewardshipService', () => {
  let service: StewardshipService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.stewardshipAntibiotico.upsert.mockResolvedValue({});
    mockPrisma.stewardshipAntibiotico.findMany.mockResolvedValue([]);
    mockPrisma.stewardshipAntibiotico.update.mockResolvedValue({});
    mockPrisma.resultadoAnalise.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StewardshipService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StewardshipService>(StewardshipService);
  });

  // ── registarSeAntibiotico() ───────────────────────────────────────────────

  describe('registarSeAntibiotico()', () => {
    it('não regista quando medicamento não é antibiótico/antifúngico', async () => {
      await service.registarSeAntibiotico('d1', 'm1', 'Paracetamol 1g');
      expect(mockPrisma.stewardshipAntibiotico.upsert).not.toHaveBeenCalled();
    });

    it('regista meropenem como broad_spectrum', async () => {
      await service.registarSeAntibiotico('d1', 'm1', 'Meropenem 500mg');
      expect(mockPrisma.stewardshipAntibiotico.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ categoria: 'broad_spectrum' }) }),
      );
    });

    it('regista fluconazol como antifungal', async () => {
      await service.registarSeAntibiotico('d1', 'm2', 'Fluconazol 150mg');
      expect(mockPrisma.stewardshipAntibiotico.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ categoria: 'antifungal' }) }),
      );
    });

    it('regista vancomicina como broad_spectrum', async () => {
      await service.registarSeAntibiotico('d1', 'm3', 'Vancomicina 1g');
      expect(mockPrisma.stewardshipAntibiotico.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ categoria: 'broad_spectrum' }) }),
      );
    });

    it('não lança exceção quando upsert falha (swallows error)', async () => {
      mockPrisma.stewardshipAntibiotico.upsert.mockRejectedValue(new Error('DB error'));
      await expect(
        service.registarSeAntibiotico('d1', 'm1', 'Meropenem 500mg'),
      ).resolves.toBeUndefined();
    });
  });

  // ── listar() ─────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('devolve registos do doente', async () => {
      const registos = [{ id: 's1', categoria: 'broad_spectrum', diasTerapia: 2, medicacao: { nome: 'Meropenem', dose: '1g', via: 'IV', ativo: true } }];
      mockPrisma.stewardshipAntibiotico.findMany.mockResolvedValue(registos);

      const resultado = await service.listar('d1');
      expect(resultado).toEqual(registos);
    });
  });

  // ── aprovar() ─────────────────────────────────────────────────────────────────

  describe('aprovar()', () => {
    it('lança NotFoundException quando registo não existe', async () => {
      mockPrisma.stewardshipAntibiotico.findUnique.mockResolvedValue(null);
      await expect(service.aprovar('id-inexistente', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('actualiza registo com aprovação', async () => {
      mockPrisma.stewardshipAntibiotico.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.stewardshipAntibiotico.update.mockResolvedValue({ id: 's1', aprovadoPor: 'user-1' });

      const resultado = await service.aprovar('s1', 'user-1');

      expect(mockPrisma.stewardshipAntibiotico.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ aprovadoPor: 'user-1' }) }),
      );
      expect(resultado).toMatchObject({ id: 's1' });
    });
  });

  // ── incrementarDOT() ──────────────────────────────────────────────────────────

  describe('incrementarDOT()', () => {
    it('incrementa diasTerapia para antibióticos ativos', async () => {
      mockPrisma.stewardshipAntibiotico.findMany.mockResolvedValue([
        {
          id: 's1', diasTerapia: 1, categoria: 'antifungal', alertaEmitido: false,
          medicacao: { ativo: true, nome: 'Fluconazol', doenteId: 'd1' },
          doente: { nome: 'Ana' },
        },
      ]);
      mockPrisma.resultadoAnalise.findMany.mockResolvedValue([]);

      await service.incrementarDOT();

      expect(mockPrisma.stewardshipAntibiotico.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ diasTerapia: 2 }) }),
      );
    });

    it('não processa antibióticos inativos', async () => {
      mockPrisma.stewardshipAntibiotico.findMany.mockResolvedValue([
        {
          id: 's1', diasTerapia: 2, categoria: 'broad_spectrum', alertaEmitido: false,
          medicacao: { ativo: false, nome: 'Meropenem', doenteId: 'd1' },
          doente: { nome: 'Rui' },
        },
      ]);

      await service.incrementarDOT();

      expect(mockPrisma.stewardshipAntibiotico.update).not.toHaveBeenCalled();
    });

    it('emite alerta de de-escalação quando broad_spectrum >= 3 dias', async () => {
      mockPrisma.stewardshipAntibiotico.findMany.mockResolvedValue([
        {
          id: 's1', diasTerapia: 2, categoria: 'broad_spectrum', alertaEmitido: false,
          medicacao: { ativo: true, nome: 'Piperacilina', doenteId: 'd1' },
          doente: { nome: 'Carlos' },
        },
      ]);

      await service.incrementarDOT();

      expect(mockPrisma.stewardshipAntibiotico.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ alertaEmitido: true }) }),
      );
    });
  });
});
