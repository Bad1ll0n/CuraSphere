import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

const mockPrisma = { $queryRaw: jest.fn(), $connect: jest.fn(), $disconnect: jest.fn() };
const mockRedis = { set: jest.fn(), get: jest.fn() };

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
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('1');

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('ok');
      expect(result.info['database']).toEqual({ status: 'up' });
      expect(result.info['redis']).toEqual({ status: 'up' });
    });

    it('lança ServiceUnavailableException quando a BD (dependência crítica) falha', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('1');

      const appController = app.get<AppController>(AppController);
      await expect(appController.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('Redis em baixo → status "degraded" (200), NÃO lança — dependência não-crítica', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue(null); // valor não confere → Redis down

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('degraded');
      expect(result.info['database']).toEqual({ status: 'up' });
      expect(result.degraded['redis']).toEqual({ status: 'down' });
    });

    it('Redis a lançar erro → degraded, não derruba o health', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      const appController = app.get<AppController>(AppController);
      const result = await appController.check();

      expect(result.status).toBe('degraded');
      expect(result.degraded['redis']).toEqual({ status: 'down' });
    });
  });
});
