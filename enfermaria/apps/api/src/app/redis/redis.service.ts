import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });

    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log('Redis conectado');
    });
    this.client.on('error', (err) => {
      this.connected = false;
      this.logger.warn(`Redis indisponível: ${err.message}`);
    });

    this.client.connect().catch(() => {
      // silent — offline queue desativada, app funciona sem cache
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // degradação silenciosa
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.connected || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      // degradação silenciosa
    }
  }
}
