import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockRedis.set.mockResolvedValue(undefined);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDetectionService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
  });

  // ── detectarAcessoBulk() ─────────────────────────────────────────────────

  describe('detectarAcessoBulk (acesso em bulk)', () => {
    it('não cria audit log com ≤15 doentes distintos na janela de 10 min', async () => {
      // Histórico com 10 doentes distintos recentes
      const agora = Date.now();
      const lista = Array.from({ length: 10 }, (_, i) => ({
        id: `doente-${i}`,
        ts: agora - i * 1000,
      }));
      mockRedis.get.mockResolvedValue(lista);

      await (service as any).detectarAcessoBulk('user-1', 'doente-10');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('cria audit log com tipo anomalia_acesso_bulk quando >15 doentes distintos', async () => {
      const agora = Date.now();
      // 15 doentes já no histórico + 1 novo = 16 distintos → anomalia
      const lista = Array.from({ length: 15 }, (_, i) => ({
        id: `doente-${i}`,
        ts: agora - i * 1000,
      }));
      mockRedis.get.mockResolvedValue(lista);

      await (service as any).detectarAcessoBulk('user-1', 'doente-15');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: 'anomalia_acesso_bulk',
            utilizadorId: 'user-1',
          }),
        }),
      );
    });

    it('filtra entradas fora da janela de 10 minutos antes de contar', async () => {
      const agora = Date.now();
      const JANELA = 10 * 60 * 1000;
      // 20 doentes mas todos foram há mais de 10 min → fora da janela → não conta
      const lista = Array.from({ length: 20 }, (_, i) => ({
        id: `doente-${i}`,
        ts: agora - JANELA - (i + 1) * 1000, // todos expirados
      }));
      mockRedis.get.mockResolvedValue(lista);

      await (service as any).detectarAcessoBulk('user-1', 'doente-novo');

      // Apenas 1 doente na janela válida → sem anomalia
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('usa lista vazia quando Redis não tem histórico para o utilizador', async () => {
      mockRedis.get.mockResolvedValue(null);

      await (service as any).detectarAcessoBulk('user-novo', 'doente-1');

      // 1 doente → sem anomalia
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'anomaly:doentes:user-novo',
        expect.arrayContaining([expect.objectContaining({ id: 'doente-1' })]),
        expect.any(Number),
      );
    });

    it('rastrearAcessoDoente dispara detectarAcessoBulk sem bloquear', () => {
      mockRedis.get.mockResolvedValue([]);
      // Deve ser fire-and-forget — não lança excepção
      expect(() => service.rastrearAcessoDoente('user-1', 'doente-1')).not.toThrow();
    });
  });

  // ── detectarIpDiferente() ─────────────────────────────────────────────────

  describe('detectarIpDiferente (login de IP diferente)', () => {
    it('cria audit log quando IP é diferente do registado', async () => {
      mockRedis.get.mockResolvedValue('192.168.1.100'); // IP anterior

      await (service as any).detectarIpDiferente('user-1', '10.0.0.50');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: 'anomalia_login_ip_diferente',
            utilizadorId: 'user-1',
            ip: '10.0.0.50',
          }),
        }),
      );
    });

    it('não cria audit log quando IP é o mesmo', async () => {
      mockRedis.get.mockResolvedValue('192.168.1.100');

      await (service as any).detectarIpDiferente('user-1', '192.168.1.100');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('não cria audit log quando é primeiro login (sem IP anterior)', async () => {
      mockRedis.get.mockResolvedValue(null);

      await (service as any).detectarIpDiferente('user-1', '192.168.1.100');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
      // Mas deve guardar o novo IP
      expect(mockRedis.set).toHaveBeenCalledWith(
        'anomaly:ip:user-1',
        '192.168.1.100',
        expect.any(Number),
      );
    });

    it('ignora localhost IPv4 (127.0.0.1)', async () => {
      mockRedis.get.mockResolvedValue('192.168.1.100');

      await (service as any).detectarIpDiferente('user-1', '127.0.0.1');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('ignora localhost IPv6 (::1)', async () => {
      mockRedis.get.mockResolvedValue('192.168.1.100');

      await (service as any).detectarIpDiferente('user-1', '::1');

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('verificarIpLogin dispara detectarIpDiferente sem bloquear', () => {
      mockRedis.get.mockResolvedValue(null);
      expect(() => service.verificarIpLogin('user-1', '10.0.0.1')).not.toThrow();
    });
  });
});
