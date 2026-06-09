import { Test, TestingModule } from '@nestjs/testing';
import { RelatoriosService } from './relatorios.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findMany: jest.fn(), count: jest.fn() },
  cama: { count: jest.fn(), groupBy: jest.fn() },
  registoMedicacao: { findMany: jest.fn() },
  episodioUrgencia: { findMany: jest.fn() },
};

const inicio = new Date('2026-01-01');
const fim = new Date('2026-01-31');

describe('RelatoriosService', () => {
  let service: RelatoriosService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatoriosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RelatoriosService>(RelatoriosService);
  });

  // ── internamento() ───────────────────────────────────────────────────────────

  describe('internamento()', () => {
    it('devolve totais e demora média por serviço', async () => {
      const admissao = new Date('2026-01-05');
      const alta = new Date('2026-01-07'); // 2 dias
      mockPrisma.doente.findMany.mockResolvedValue([
        { id: 'd1', nome: 'Ana', dataAdmissao: admissao, dataAlta: alta, diagnosticoPrincipal: 'Pneumonia', cama: { servico: 'medicina' } },
        { id: 'd2', nome: 'Rui', dataAdmissao: admissao, dataAlta: alta, diagnosticoPrincipal: 'Pneumonia', cama: { servico: 'medicina' } },
      ]);

      const resultado = await service.internamento(inicio, fim);

      expect(resultado.totalInternamentos).toBe(2);
      expect(resultado.resumoPorServico[0].servico).toBe('medicina');
      expect(resultado.resumoPorServico[0].demoraMediaDias).toBe(2.0);
    });

    it('devolve totais zero quando sem doentes no período', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([]);

      const resultado = await service.internamento(inicio, fim);

      expect(resultado.totalInternamentos).toBe(0);
      expect(resultado.resumoPorServico).toHaveLength(0);
    });

    it('usa sem_servico quando cama é null', async () => {
      const admissao = new Date('2026-01-05');
      const alta = new Date('2026-01-06');
      mockPrisma.doente.findMany.mockResolvedValue([
        { id: 'd1', dataAdmissao: admissao, dataAlta: alta, diagnosticoPrincipal: 'X', cama: null },
      ]);

      const resultado = await service.internamento(inicio, fim);

      expect(resultado.resumoPorServico[0].servico).toBe('sem_servico');
    });
  });

  // ── ocupacao() ───────────────────────────────────────────────────────────────

  describe('ocupacao()', () => {
    it('calcula taxa de ocupação correctamente', async () => {
      mockPrisma.cama.count.mockResolvedValue(10);
      mockPrisma.doente.count.mockResolvedValue(7);
      mockPrisma.cama.groupBy.mockResolvedValue([
        { estado: 'ocupada', _count: { estado: 7 } },
        { estado: 'livre', _count: { estado: 3 } },
      ]);

      const resultado = await service.ocupacao(inicio, fim);

      expect(resultado.totalCamas).toBe(10);
      expect(resultado.internamentosAtivos).toBe(7);
      expect(resultado.taxaOcupacaoAtual).toBe(70.0);
    });

    it('taxa de ocupação é 0 quando não há camas', async () => {
      mockPrisma.cama.count.mockResolvedValue(0);
      mockPrisma.doente.count.mockResolvedValue(0);
      mockPrisma.cama.groupBy.mockResolvedValue([]);

      const resultado = await service.ocupacao(inicio, fim);

      expect(resultado.taxaOcupacaoAtual).toBe(0);
    });
  });

  // ── diagnosticos() ───────────────────────────────────────────────────────────

  describe('diagnosticos()', () => {
    it('agrupa diagnósticos por frequência (top20)', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([
        { diagnosticoPrincipal: 'Pneumonia' },
        { diagnosticoPrincipal: 'Pneumonia' },
        { diagnosticoPrincipal: 'AVC' },
      ]);

      const resultado = await service.diagnosticos(inicio, fim);

      expect(resultado.totalDoentes).toBe(3);
      const pneumonia = resultado.top20.find((d: any) => d.diagnostico === 'Pneumonia');
      expect(pneumonia?.total).toBe(2);
    });

    it('devolve top20 vazio quando sem doentes', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([]);

      const resultado = await service.diagnosticos(inicio, fim);

      expect(resultado.totalDoentes).toBe(0);
      expect(resultado.top20).toHaveLength(0);
    });
  });
});
