import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InterconsultasService } from './interconsultas.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: {
    findUnique: jest.fn(),
  },
  interconsulta: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('InterconsultasService', () => {
  let service: InterconsultasService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterconsultasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InterconsultasService>(InterconsultasService);
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criar('doente-inexistente', 'req-1', { especialidadeAlvo: 'cardiologia', motivo: 'avaliação' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria interconsulta com estado "pendente" e solicitadoPorId correto', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João Silva' });
      const interconsultaCriada = {
        id: 'ic-1',
        doenteId: 'doente-1',
        requisitanteId: 'req-1',
        especialidadeAlvo: 'cardiologia',
        motivo: 'avaliação cardíaca',
        urgente: false,
        estado: 'pendente',
        requisitante: { id: 'req-1', nome: 'Dr. Maria', role: 'medico', subRole: null },
        doente: { id: 'doente-1', nome: 'João Silva' },
      };
      mockPrisma.interconsulta.create.mockResolvedValue(interconsultaCriada);

      const resultado = await service.criar('doente-1', 'req-1', {
        especialidadeAlvo: 'cardiologia',
        motivo: 'avaliação cardíaca',
      });

      expect(mockPrisma.interconsulta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doenteId: 'doente-1',
            requisitanteId: 'req-1',
            especialidadeAlvo: 'cardiologia',
            motivo: 'avaliação cardíaca',
            urgente: false,
          }),
        }),
      );
      expect(resultado).toEqual(interconsultaCriada);
    });
  });

  // ── aceitar() ────────────────────────────────────────────────────────────────

  describe('aceitar()', () => {
    it('lança NotFoundException quando interconsulta não existe', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue(null);

      await expect(
        service.aceitar('ic-inexistente', 'medico-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('actualiza estado para "aceite" com medicoId correto', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue({
        id: 'ic-1', estado: 'pendente',
      });
      mockPrisma.interconsulta.update.mockResolvedValue({
        id: 'ic-1', estado: 'aceite', medicoRespostaId: 'medico-1',
      });

      const resultado = await service.aceitar('ic-1', 'medico-1');

      expect(mockPrisma.interconsulta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ic-1' },
          data: expect.objectContaining({ estado: 'aceite', medicoRespostaId: 'medico-1' }),
        }),
      );
      expect(resultado).toHaveProperty('estado', 'aceite');
    });
  });

  // ── responder() ──────────────────────────────────────────────────────────────

  describe('responder()', () => {
    it('lança NotFoundException quando interconsulta não existe', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue(null);

      await expect(
        service.responder('ic-inexistente', 'medico-1', 'sem alterações'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando interconsulta já foi respondida', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue({
        id: 'ic-1', estado: 'respondida',
      });

      await expect(
        service.responder('ic-1', 'medico-1', 'nova resposta'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza estado para "respondida" com resposta e medicoRespostaId', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue({
        id: 'ic-1', estado: 'aceite',
      });
      mockPrisma.interconsulta.update.mockResolvedValue({
        id: 'ic-1',
        estado: 'respondida',
        resposta: 'Sem alterações cardíacas significativas',
        medicoRespostaId: 'medico-1',
        medicoResposta: { id: 'medico-1', nome: 'Dr. Costa' },
      });

      const resultado = await service.responder('ic-1', 'medico-1', 'Sem alterações cardíacas significativas');

      expect(mockPrisma.interconsulta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ic-1' },
          data: expect.objectContaining({
            estado: 'respondida',
            medicoRespostaId: 'medico-1',
            resposta: 'Sem alterações cardíacas significativas',
          }),
        }),
      );
      expect(resultado).toHaveProperty('estado', 'respondida');
    });
  });

  // ── cancelar() ───────────────────────────────────────────────────────────────

  describe('cancelar()', () => {
    it('lança NotFoundException quando interconsulta não existe', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelar('ic-inexistente', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando utilizador não é o requisitante', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue({
        id: 'ic-1', estado: 'pendente', requisitanteId: 'outro-user',
      });

      await expect(
        service.cancelar('ic-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cancela interconsulta quando utilizador é o requisitante', async () => {
      mockPrisma.interconsulta.findUnique.mockResolvedValue({
        id: 'ic-1', estado: 'pendente', requisitanteId: 'req-1',
      });
      mockPrisma.interconsulta.update.mockResolvedValue({ id: 'ic-1', estado: 'cancelada' });

      await service.cancelar('ic-1', 'req-1');

      expect(mockPrisma.interconsulta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ic-1' },
          data: expect.objectContaining({ estado: 'cancelada' }),
        }),
      );
    });
  });

  // ── listarPorDoente() ────────────────────────────────────────────────────────

  describe('listarPorDoente()', () => {
    it('devolve lista de interconsultas filtradas por doenteId', async () => {
      const lista = [
        { id: 'ic-1', doenteId: 'doente-1', estado: 'pendente' },
        { id: 'ic-2', doenteId: 'doente-1', estado: 'respondida' },
      ];
      mockPrisma.interconsulta.findMany.mockResolvedValue(lista);

      const resultado = await service.listarPorDoente('doente-1');

      expect(mockPrisma.interconsulta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1' }),
        }),
      );
      expect(resultado).toHaveLength(2);
    });
  });

  // ── listarPendentes() ────────────────────────────────────────────────────────

  describe('listarPendentes()', () => {
    it('filtra por especialidadeAlvo e estado "pendente"', async () => {
      const lista = [
        { id: 'ic-1', especialidadeAlvo: 'cardiologia', estado: 'pendente' },
      ];
      mockPrisma.interconsulta.findMany.mockResolvedValue(lista);

      const resultado = await service.listarPendentes('cardiologia');

      expect(mockPrisma.interconsulta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ especialidadeAlvo: 'cardiologia', estado: 'pendente' }),
        }),
      );
      expect(resultado).toEqual(lista);
    });
  });
});
