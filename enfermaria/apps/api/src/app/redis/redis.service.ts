import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { cifrarSegredo, decifrarSegredo } from '../prisma/encryption.middleware';

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
    // OPS-09: no encerramento ordenado (SIGTERM), um Redis já em baixo não pode impedir a saída.
    await this.client.quit().catch(() => this.client.disconnect());
  }

  /** OPS-06: verificação de saúde sem escrever nada (antes o health fazia SET a cada chamada). */
  async ping(): Promise<boolean> {
    if (!this.connected) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
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

  /**
   * SET com NX (only-if-not-exists) + EX (TTL).
   * Devolve `true` se a chave foi criada (o caller obteve "lock"),
   * `false` se já existia (replay detectado).
   *
   * Quando Redis está indisponível devolve `null` — caller decide a política
   * (fail-open vs fail-closed). Para segurança crítica (anti-replay TOTP),
   * o caller deve interpretar `null` como "indisponível" e recusar.
   */
  /**
   * PERF-07 — cache de dados que trazem PII (nomes, diagnósticos): o valor vai CIFRADO para o Redis
   * (AES-GCM, ENCRYPTION_KEY), como na BD. Um dump do Redis deixava de ser uma lista de doentes.
   */
  async setCifrado(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.set(key, cifrarSegredo(JSON.stringify(value)), ttlSeconds);
  }

  async getCifrado<T>(key: string): Promise<T | null> {
    const bruto = await this.get<string>(key);
    if (typeof bruto !== 'string') return null;
    try { return JSON.parse(decifrarSegredo(bruto)) as T; } catch { return null; } // ilegível (chave rodada) = miss
  }

  /** O valor em bruto (sem JSON.parse); `null` se não existir ou o Redis estiver indisponível. */
  async obterTexto(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try { return await this.client.get(key); } catch { return null; }
  }

  /** GETDEL — lê e apaga numa só operação (consumo de uso único, sem corrida entre pedidos). */
  async consumir(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try { return await this.client.getdel(key); } catch { return null; }
  }

  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean | null> {
    if (!this.connected) return null;
    try {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return null;
    }
  }
}
