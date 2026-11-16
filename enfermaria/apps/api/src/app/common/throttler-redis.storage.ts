import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * ARQ-17 / OPS-09 — contagem de pedidos partilhada pelas réplicas da API.
 *
 * O armazenamento por omissão do @nestjs/throttler é um Map em memória: com N réplicas atrás do
 * nginx, o limite de tentativas de login (e todos os outros) passava a valer N vezes. Aqui a
 * contagem vive no Redis, numa janela fixa atómica (script Lua: INCR + PEXPIRE + bloqueio).
 *
 * Se o Redis falhar, cai para a contagem local da réplica — o comportamento anterior, nunca
 * "sem limite".
 */
const SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local bloq = redis.call('PTTL', KEYS[2])
if bloq < 0 and hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  bloq = tonumber(ARGV[3])
end
return {hits, ttl, bloq}
`;

export class ThrottlerRedisStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(ThrottlerRedisStorage.name);
  private readonly local = new ThrottlerStorageService();
  private readonly redis: Redis | null;
  private avisado = false;

  constructor(url: string | undefined = process.env['REDIS_URL'], cliente?: Redis) {
    this.redis = cliente ?? (url ? new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 }) : null);
    this.redis?.connect().catch(() => undefined);
    this.redis?.on('error', () => undefined);
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const chave = `throttle:${throttlerName}:${key}`;
        const [hits, ttlMs, bloqMs] = (await this.redis.eval(SCRIPT, 2, chave, `${chave}:bloqueado`, ttl, limit, blockDuration)) as number[];
        const bloqueado = bloqMs > 0;
        return {
          totalHits: hits,
          timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
          isBlocked: bloqueado,
          timeToBlockExpire: bloqueado ? Math.ceil(bloqMs / 1000) : 0,
        };
      } catch (e) {
        if (!this.avisado) this.logger.warn(`Throttler sem Redis, contagem local: ${(e as Error).message}`);
        this.avisado = true;
      }
    }
    return this.local.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  async onModuleDestroy() {
    this.local.onApplicationShutdown?.();
    await this.redis?.quit().catch(() => undefined);
  }
}
