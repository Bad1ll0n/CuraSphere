import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  doente: {
    findUnique: jest.fn(),
  },
  avaliacaoRisco: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAlertasService = {
  criarAlerta: jest.fn(),
};

const mockNotificacoesService = {
  enviarParaDoente: jest.fn().mockResolvedValue(undefined),
};

describe('EscalasService', () => {
  let service: EscalasService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotificacoesService.enviarParaDoente.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertasService },
        { provide: NotificacoesService, useValue: mockNotificacoesService },
      ],
    }).compile();

    service = module.get<EscalasService>(EscalasService);
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança ForbiddenException quando role não tem permissão', async () => {
      await expect(
        service.criar('doente-1', 'user-1', 'admin', 'braden', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criar('doente-inexistente', 'user-1', 'enfermeiro', 'braden', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria registo de avaliação Braden com pontuação < 12 (risco alto)', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', ativo: true, nome: 'João Silva' });
      const avaliacaoCriada = {
        id: 'aval-1',
        doenteId: 'doente-1',
        tipo: 'braden',
        pontuacao: 10,
        risco: 'alto',
        registadoPor: { nome: 'Enf. Maria' },
      };
      mockPrisma.avaliacaoRisco.create.mockResolvedValue(avaliacaoCriada);

      // Braden: soma dos itens = 10 → pontuação ≤ 12 → risco 'alto'
      const itens = {
        percepcaoSensorial: 2,
        humidade: 2,
        atividade: 2,
        mobilidade: 2,
        nutricao: 1,
        friccaoCisalhamento: 1,
      };

      const resultado = await service.criar('doente-1', 'user-1', 'enfermeiro', 'braden', itens);

      expect(mockPrisma.avaliacaoRisco.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doenteId: 'doente-1',
            registadoPorId: 'user-1',
            tipo: 'braden',
            pontuacao: 10,
            risco: 'alto',
          }),
        }),
      );
      expect(resultado).toEqual(avaliacaoCriada);
    });

    it('cria registo de avaliação Morse com pontuação > 44 (risco alto)', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', ativo: true, nome: 'João Silva' });
      const avaliacaoCriada = {
        id: 'aval-2',
        doenteId: 'doente-1',
        tipo: 'morse',
        pontuacao: 65,
        risco: 'alto',
        registadoPor: { nome: 'Enf. Maria' },
      };
      mockPrisma.avaliacaoRisco.create.mockResolvedValue(avaliacaoCriada);

      // Morse: soma = 65 → ≥ 45 → risco 'alto'
      const itens = {
        historiaQueda: 25,
        diagnosticoSecundario: 15,
        ajudaMarcha: 10,
        heparinaIV: 10,
        marchaTransferencia: 3,
        estadoMental: 2,
      };

      const resultado = await service.criar('doente-1', 'user-1', 'medico', 'morse', itens);

      expect(mockPrisma.avaliacaoRisco.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'morse',
            pontuacao: 65,
            risco: 'alto',
          }),
        }),
      );
      expect(resultado).toEqual(avaliacaoCriada);
    });

    it('cria avaliação e aciona alertas quando risco é alto', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', ativo: true, nome: 'João Silva' });
      mockPrisma.avaliacaoRisco.create.mockResolvedValue({
        id: 'aval-3', doenteId: 'doente-1', tipo: 'braden', pontuacao: 8, risco: 'muito_alto',
        registadoPor: { nome: 'Enf. Maria' },
      });

      const itens = {
        percepcaoSensorial: 1, humidade: 1, atividade: 1,
        mobilidade: 1, nutricao: 2, friccaoCisalhamento: 2,
      };

      await service.criar('doente-1', 'user-1', 'enfermeiro', 'braden', itens);

      expect(mockAlertasService.criarAlerta).toHaveBeenCalledWith(
        'doente-1',
        'risco_clinico',
        expect.stringContaining('Muito Alto'),
      );
    });
  });

  // ── listarUltimas() ──────────────────────────────────────────────────────────

  describe('listarUltimas()', () => {
    it('devolve o último registo Braden e Morse para o doenteId', async () => {
      const bradeno = { id: 'b1', doenteId: 'doente-1', tipo: 'braden', pontuacao: 14, risco: 'moderado' };
      const morse = { id: 'm1', doenteId: 'doente-1', tipo: 'morse', pontuacao: 20, risco: 'baixo' };
      mockPrisma.avaliacaoRisco.findFirst
        .mockResolvedValueOnce(bradeno)
        .mockResolvedValueOnce(morse);

      const resultado = await service.listarUltimas('doente-1');

      expect(resultado).toEqual({ braden: bradeno, morse });
      expect(mockPrisma.avaliacaoRisco.findFirst).toHaveBeenCalledTimes(2);
      expect(mockPrisma.avaliacaoRisco.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doenteId: 'doente-1', tipo: 'braden' } }),
      );
    });
  });

  // ── historico() ──────────────────────────────────────────────────────────────

  describe('historico()', () => {
    it('filtra por tipo quando tipo é fornecido', async () => {
      const registos = [{ id: 'b1', tipo: 'braden', pontuacao: 14 }];
      mockPrisma.avaliacaoRisco.findMany.mockResolvedValue(registos);

      const resultado = await service.historico('doente-1', 'braden');

      expect(mockPrisma.avaliacaoRisco.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1', tipo: 'braden' }),
        }),
      );
      expect(resultado).toEqual(registos);
    });

    it('devolve todos os tipos quando tipo não é fornecido', async () => {
      const registos = [
        { id: 'b1', tipo: 'braden', pontuacao: 14 },
        { id: 'm1', tipo: 'morse', pontuacao: 30 },
      ];
      mockPrisma.avaliacaoRisco.findMany.mockResolvedValue(registos);

      const resultado = await service.historico('doente-1');

      expect(mockPrisma.avaliacaoRisco.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1' }),
        }),
      );
      // Quando não há tipo, o where não deve conter a propriedade 'tipo'
      const chamada = mockPrisma.avaliacaoRisco.findMany.mock.calls[0][0];
      expect(chamada.where).not.toHaveProperty('tipo');
      expect(resultado).toHaveLength(2);
    });
  });
});
