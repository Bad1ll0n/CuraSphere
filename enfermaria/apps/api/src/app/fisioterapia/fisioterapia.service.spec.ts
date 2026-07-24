import { Test, TestingModule } from '@nestjs/testing';
import { FisioterapiaService } from './fisioterapia.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  planoReabilitacao: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  sessaoFisioterapia: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const planoBase = { id: 'pl-1', doenteId: 'd1', objetivos: 'Recuperar mobilidade', fisioterapeutaId: 'ft-1' };
const sessaoBase = { id: 'ses-1', planoId: 'pl-1', doenteId: 'd1', estado: 'agendada', data: new Date('2026-06-15') };

describe('FisioterapiaService', () => {
  let service: FisioterapiaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FisioterapiaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FisioterapiaService>(FisioterapiaService);
  });

  describe('criarPlano()', () => {
    it('cria plano de reabilitação', async () => {
      mockPrisma.planoReabilitacao.create.mockResolvedValue(planoBase);

      const resultado = await service.criarPlano(
        'd1',
        { objetivos: 'Recuperar mobilidade', dataInicio: new Date().toISOString() },
        'ft-1',
      );

      expect(resultado.objetivos).toBe('Recuperar mobilidade');
    });
  });

  describe('planoPorDoente()', () => {
    it('devolve planos do doente', async () => {
      mockPrisma.planoReabilitacao.findMany.mockResolvedValue([planoBase]);

      const resultado = await service.planoPorDoente('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('agendarSessao()', () => {
    it('agenda sessão de fisioterapia', async () => {
      mockPrisma.sessaoFisioterapia.create.mockResolvedValue(sessaoBase);

      const resultado = await service.agendarSessao(
        { planoId: 'pl-1', doenteId: 'd1', data: new Date().toISOString(), duracao: 45, descricao: 'Exercícios' },
        'ft-1',
      );

      expect(resultado.planoId).toBe('pl-1');
    });
  });

  describe('realizarSessao()', () => {
    it('conclui sessão com evolução', async () => {
      mockPrisma.sessaoFisioterapia.findUnique.mockResolvedValue(sessaoBase);
      mockPrisma.sessaoFisioterapia.update.mockResolvedValue({ ...sessaoBase, estado: 'realizada' });

      const resultado = await service.realizarSessao('ses-1', { evolucao: 'Boa evolução' });

      expect(resultado.estado).toBe('realizada');
    });
  });

  describe('agendaFisioterapeuta()', () => {
    it('devolve sessões agendadas do fisioterapeuta', async () => {
      mockPrisma.sessaoFisioterapia.findMany.mockResolvedValue([sessaoBase]);

      const resultado = await service.agendaFisioterapeuta('ft-1');

      expect(resultado).toHaveLength(1);
    });
  });
});
