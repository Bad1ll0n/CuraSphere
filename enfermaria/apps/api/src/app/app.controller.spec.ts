import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from './prisma/prisma.service';
import { RedisHealthIndicator } from './redis/redis.health';

const mockHealthCheck = { check: jest.fn() };
const mockPrismaIndicator = { pingCheck: jest.fn() };
const mockRedisIndicator = { isHealthy: jest.fn() };
const mockPrisma = { $queryRaw: jest.fn(), $connect: jest.fn(), $disconnect: jest.fn() };

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: HealthCheckService, useValue: mockHealthCheck },
        { provide: PrismaHealthIndicator, useValue: mockPrismaIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
  });

  describe('getData', () => {
    it('should return "CuraSphere API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'CuraSphere API' });
    });
  });
});
