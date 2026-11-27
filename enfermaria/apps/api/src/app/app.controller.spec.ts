import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { AuditoriaInstaladaService } from './common/auditoria-instalada.service';

const mockPrisma = { $queryRaw: jest.fn(), $connect: jest.fn(), $disconnect: jest.fn() };
const mockRedis = { set: jest.fn(), get: jest.fn(), ping: jest.fn() };

describe('AppController', () => {
  let app: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AuditoriaInstaladaService, useValue: { verificar: jest.fn().mockResolvedValue({ funcao: true, tabelasSemTrigger: [] }) } },
      ],
    }).compile();
  });

  describe('getData', () => {
    it('should return "CuraSphere API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'CuraSphere API' });
    });
  });

  describe('health check', () => {
    it('devolve status ok quando a BD e o Redis respondem', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('ok');
      expect(result.info['database']).toEqual({ status: 'up' });
      expect(result.info['redis']).toEqual({ status: 'up' });
    });

    it('lança ServiceUnavailableException quando a BD (dependência crítica) falha', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockRedis.ping.mockResolvedValue(true);

      const appController = app.get<AppController>(AppController);
      await expect(appController.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('Redis em baixo → status "degraded" (200), NÃO lança — dependência não-crítica', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(false); // sem PONG → Redis down

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('degraded');
      expect(result.info['database']).toEqual({ status: 'up' });
      expect(result.degraded['redis']).toEqual({ status: 'down' });
    });

    it('Redis a lançar erro → degraded, não derruba o health', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('degraded');
      expect(result.degraded['redis']).toEqual({ status: 'down' });
    });

    it('OPS-06: o health não escreve no Redis', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ pendentes: 0, ultima: '2026_x' }]);
      mockRedis.ping.mockResolvedValue(true);
      await app.get<AppController>(AppController).check();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('OPS-06: migração falhada/por terminar → 503', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ pendentes: 1, ultima: '2026_x' }]);
      mockRedis.ping.mockResolvedValue(true);
      await expect(app.get<AppController>(AppController).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('OPS-06: liveness não toca em nada', () => {
      const r = app.get<AppController>(AppController).live();
      expect(r.status).toBe('ok');
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
