jest.mock('ioredis', () => {
  const mockClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  return jest.fn().mockImplementation(() => mockClient);
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'REDIS_URL') return 'redis://localhost:6379';
    return fallback ?? '';
  }),
};

describe('RedisService', () => {
  let service: RedisService;

  afterEach(async () => {
    await service?.onModuleDestroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = module.get<RedisService>(RedisService);
    service.onModuleInit();
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('get()', () => {
    it('devolve null quando Redis desligado ou chave inexistente', async () => {
      const r = await service.get('chave-teste');
      expect(r).toBeNull();
    });
  });

  describe('set()', () => {
    it('não lança quando Redis indisponível', async () => {
      await expect(service.set('k', { valor: 1 }, 60)).resolves.not.toThrow();
    });
  });

  describe('del()', () => {
    it('não lança quando Redis indisponível', async () => {
      await expect(service.del('k1', 'k2')).resolves.not.toThrow();
    });
  });
});
