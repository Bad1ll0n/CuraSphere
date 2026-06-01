import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BreakGlassService } from './break-glass.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  doente: {
    findUnique: jest.fn(),
  },
  breakGlassAccess: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  utilizador: {
    findMany: jest.fn(),
  },
};

const mockNotificacoes = {
  enviarParaRole: jest.fn().mockResolvedValue(undefined),
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

describe('BreakGlassService', () => {
  let service: BreakGlassService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotificacoes.enviarParaRole.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.utilizador.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakGlassService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<BreakGlassService>(BreakGlassService);
  });

  // ── ativar() ─────────────────────────────────────────────────────────────────

  describe('ativar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.ativar('user-1', 'doente-inexistente', 'emergência'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria registo breakGlassAccess com expiradoEm ~4h a partir de agora', async () => {
      const antes = Date.now();
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João Silva' });
      mockPrisma.breakGlassAccess.create.mockResolvedValue({
        id: 'bg-1',
        utilizadorId: 'user-1',
        doenteId: 'doente-1',
        motivo: 'emergência',
        expiradoEm: new Date(antes + 4 * 60 * 60 * 1000),
        utilizador: { id: 'user-1', nome: 'Dr. Ana', role: 'medico' },
        doente: { id: 'doente-1', nome: 'João Silva', numeroProcesso: '12345' },
      });

      const resultado = await service.ativar('user-1', 'doente-1', 'emergência', '192.168.1.1');

      expect(mockPrisma.breakGlassAccess.create).toHaveBeenCalledTimes(1);
      const chamada = mockPrisma.breakGlassAccess.create.mock.calls[0][0];
      const expiradoEm: Date = chamada.data.expiradoEm;

      // expiradoEm deve estar ~4h no futuro (tolerância de 5 segundos)
      const quatroHorasMs = 4 * 60 * 60 * 1000;
      expect(expiradoEm.getTime()).toBeGreaterThanOrEqual(antes + quatroHorasMs - 5000);
      expect(expiradoEm.getTime()).toBeLessThanOrEqual(antes + quatroHorasMs + 5000);

      expect(resultado).toHaveProperty('id', 'bg-1');
    });

    it('regista audit log (prisma.auditLog.create é chamado)', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João Silva' });
      mockPrisma.breakGlassAccess.create.mockResolvedValue({
        id: 'bg-1',
        utilizador: { id: 'user-1', nome: 'Dr. Ana', role: 'medico' },
        doente: { id: 'doente-1', nome: 'João Silva', numeroProcesso: '12345' },
      });

      await service.ativar('user-1', 'doente-1', 'emergência cirúrgica');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utilizadorId: 'user-1',
            acao: 'BREAK_GLASS_ACTIVADO',
            entidadeTipo: 'Doente',
            entidadeId: 'doente-1',
          }),
        }),
      );
    });

    it('cria com utilizadorId, doenteId e motivo corretos', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Maria Santos' });
      mockPrisma.breakGlassAccess.create.mockResolvedValue({
        id: 'bg-2',
        utilizadorId: 'user-2',
        doenteId: 'doente-1',
        motivo: 'paragem cardíaca',
        utilizador: { id: 'user-2', nome: 'Enf. Pedro', role: 'enfermeiro' },
        doente: { id: 'doente-1', nome: 'Maria Santos', numeroProcesso: '99999' },
      });

      await service.ativar('user-2', 'doente-1', 'paragem cardíaca');

      expect(mockPrisma.breakGlassAccess.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utilizadorId: 'user-2',
            doenteId: 'doente-1',
            motivo: 'paragem cardíaca',
          }),
        }),
      );
    });
  });

  // ── verificarAtivoParaDoente() ────────────────────────────────────────────────

  describe('verificarAtivoParaDoente()', () => {
    it('devolve true quando existe acesso activo não expirado', async () => {
      mockPrisma.breakGlassAccess.findFirst.mockResolvedValue({ id: 'bg-1' });

      const resultado = await service.verificarAtivoParaDoente('user-1', 'doente-1');

      expect(resultado).toBe(true);
    });

    it('devolve false quando não existe acesso activo', async () => {
      mockPrisma.breakGlassAccess.findFirst.mockResolvedValue(null);

      const resultado = await service.verificarAtivoParaDoente('user-1', 'doente-1');

      expect(resultado).toBe(false);
    });
  });

  // ── listar() ─────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('devolve lista de acessos sem filtro quando doenteId não é fornecido', async () => {
      const lista = [
        { id: 'bg-1', doenteId: 'doente-1' },
        { id: 'bg-2', doenteId: 'doente-2' },
      ];
      mockPrisma.breakGlassAccess.findMany.mockResolvedValue(lista);

      const resultado = await service.listar();

      expect(mockPrisma.breakGlassAccess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(resultado).toHaveLength(2);
    });

    it('filtra por doenteId quando fornecido', async () => {
      const lista = [{ id: 'bg-1', doenteId: 'doente-1' }];
      mockPrisma.breakGlassAccess.findMany.mockResolvedValue(lista);

      const resultado = await service.listar('doente-1');

      expect(mockPrisma.breakGlassAccess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1' }),
        }),
      );
      expect(resultado).toEqual(lista);
    });
  });
});
