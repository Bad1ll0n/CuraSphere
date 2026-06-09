import { Test, TestingModule } from '@nestjs/testing';
import { NotificacoesService } from './notificacoes.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  dispositivoToken: { upsert: jest.fn(), findMany: jest.fn() },
  notificacaoInApp: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  utilizador: { findMany: jest.fn() },
};

describe('NotificacoesService', () => {
  let service: NotificacoesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dispositivoToken.findMany.mockResolvedValue([]);
    mockPrisma.notificacaoInApp.create.mockResolvedValue({ id: 'n-1' });
    mockPrisma.notificacaoInApp.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificacoesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<NotificacoesService>(NotificacoesService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registarToken()', () => {
    it('regista token de dispositivo', async () => {
      mockPrisma.dispositivoToken.upsert.mockResolvedValue({ id: 'dt-1', token: 'expo-tok', utilizadorId: 'u1' });
      const r = await service.registarToken('u1', 'expo-tok', 'android');
      expect(r.token).toBe('expo-tok');
    });
  });

  describe('enviarParaUtilizador()', () => {
    it('persiste notificação in-app', async () => {
      await service.enviarParaUtilizador('u1', 'Título', 'Corpo', {});
      expect(mockPrisma.notificacaoInApp.create).toHaveBeenCalled();
    });

    it('não falha quando utilizador não tem dispositivos', async () => {
      mockPrisma.dispositivoToken.findMany.mockResolvedValue([]);
      await expect(service.enviarParaUtilizador('u1', 'T', 'C')).resolves.not.toThrow();
    });
  });
});
