import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TrocasService } from './trocas.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  pedidoTrocaTurno: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  utilizador: { findUnique: jest.fn() },
  horarioTurnoProfissional: { findMany: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(),
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

const pedidoBase = {
  id: 'pt-1', solicitanteId: 'u1', destinatarioId: 'u2', turnoId: 't1', estado: 'pendente_destinatario',
};

describe('TrocasService', () => {
  let service: TrocasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.pedidoTrocaTurno.findMany.mockResolvedValue([]);
    mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'u1', role: 'enfermeiro', ordemExperiencia: 1 });
    mockPrisma.horarioTurnoProfissional.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrocasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();
    service = module.get<TrocasService>(TrocasService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve pedidos de troca do utilizador', async () => {
      mockPrisma.pedidoTrocaTurno.findMany.mockResolvedValue([pedidoBase]);
      const r = await service.listar('u1');
      expect(r).toHaveLength(1);
    });
  });

  describe('cancelar()', () => {
    it('cancela pedido', async () => {
      mockPrisma.pedidoTrocaTurno.findUnique.mockResolvedValue(pedidoBase);
      mockPrisma.pedidoTrocaTurno.delete.mockResolvedValue(pedidoBase);
      const r = await service.cancelar('pt-1', 'u1');
      expect(r.id).toBe('pt-1');
    });

    it('lança NotFoundException quando pedido não existe', async () => {
      mockPrisma.pedidoTrocaTurno.findUnique.mockResolvedValue(null);
      await expect(service.cancelar('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando não é o solicitante', async () => {
      mockPrisma.pedidoTrocaTurno.findUnique.mockResolvedValue(pedidoBase);
      await expect(service.cancelar('pt-1', 'outro')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('aprovarChefe()', () => {
    it('lança NotFoundException quando pedido não existe', async () => {
      mockPrisma.pedidoTrocaTurno.findUnique.mockResolvedValue(null);
      await expect(service.aprovarChefe('x', 'chefe', true)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando pedido não está pendente', async () => {
      mockPrisma.pedidoTrocaTurno.findUnique.mockResolvedValue({ ...pedidoBase, estado: 'aprovado' });
      await expect(service.aprovarChefe('pt-1', 'chefe', true)).rejects.toThrow(BadRequestException);
    });
  });
});
