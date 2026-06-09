import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RelatorioPassagemTurnoService } from './relatorio-passagem-turno.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: {
    findMany: jest.fn(),
  },
  relatorioPassagemTurno: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('RelatorioPassagemTurnoService', () => {
  let service: RelatorioPassagemTurnoService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatorioPassagemTurnoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RelatorioPassagemTurnoService>(RelatorioPassagemTurnoService);
  });

  // ── gerarRascunho() ───────────────────────────────────────────────────────────

  describe('gerarRascunho()', () => {
    it('gera rascunho com "0 doentes activos" quando lista está vazia', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([]);
      mockPrisma.relatorioPassagemTurno.create.mockResolvedValue({
        id: 'rel-1', turno: 'manha', servico: 'medicina',
        criadaPor: { id: 'user-1', nome: 'Enfermeira', role: 'enfermeiro' },
      });

      await service.gerarRascunho({ turno: 'manha', servico: 'medicina' }, 'user-1');

      const createCall = mockPrisma.relatorioPassagemTurno.create.mock.calls[0][0];
      expect(createCall.data.rascunho).toContain('Total de doentes activos: 0');
    });

    it('cria relatório com criadaPorId correcto quando há doentes', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([
        {
          id: 'd1', nome: 'João Ferreira', diagnosticoPrincipal: 'Pneumonia',
          dataAdmissao: new Date(), cama: { numero: '101' },
          sinaisVitais: [{ news2: 3, data: new Date(), pulso: 80, pressaoSistolica: 120, saturacaoO2: 98, temperatura: 37 }],
          sinalizacoes: [], alertasSepsis: [], alertasClinicos: [], tarefas: [],
        },
      ]);
      mockPrisma.relatorioPassagemTurno.create.mockResolvedValue({
        id: 'rel-2', criadaPor: { id: 'user-1', nome: 'Ana', role: 'enfermeiro' },
      });

      await service.gerarRascunho({ turno: 'tarde', servico: 'cirurgia' }, 'user-1');

      expect(mockPrisma.relatorioPassagemTurno.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ criadaPorId: 'user-1', turno: 'tarde', servico: 'cirurgia' }),
        }),
      );
    });
  });

  // ── confirmar() ───────────────────────────────────────────────────────────────

  describe('confirmar()', () => {
    it('lança NotFoundException para id inexistente', async () => {
      mockPrisma.relatorioPassagemTurno.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmar('id-x', { conteudo: 'conteúdo final' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('persiste conteúdo confirmado e confirmadaPorId', async () => {
      mockPrisma.relatorioPassagemTurno.findUnique.mockResolvedValue({ id: 'rel-1' });
      mockPrisma.relatorioPassagemTurno.update.mockResolvedValue({
        id: 'rel-1', conteudo: 'conteúdo final', confirmadaPorId: 'user-2',
      });

      await service.confirmar('rel-1', { conteudo: 'conteúdo final' }, 'user-2');

      expect(mockPrisma.relatorioPassagemTurno.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rel-1' },
          data: expect.objectContaining({
            conteudo: 'conteúdo final',
            confirmadaPorId: 'user-2',
            confirmadaEm: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ── historico() ───────────────────────────────────────────────────────────────

  describe('historico()', () => {
    it('consulta findMany com orderBy criadaEm desc', async () => {
      mockPrisma.relatorioPassagemTurno.findMany.mockResolvedValue([]);

      await service.historico('medicina');

      expect(mockPrisma.relatorioPassagemTurno.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { servico: 'medicina' },
          orderBy: { criadaEm: 'desc' },
        }),
      );
    });
  });
});
