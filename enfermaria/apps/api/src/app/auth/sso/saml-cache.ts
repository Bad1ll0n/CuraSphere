import type { CacheItem, CacheProvider } from '@node-saml/node-saml';
import type { RedisService } from '../../redis/redis.service';

/**
 * SEC-06 — a cache de pedidos e de assertions SAML no Redis.
 *
 * O controlador cria uma instância `SAML` por pedido. A cache por omissão do node-saml vive em
 * memória DESSA instância, por isso o ID gravado no `GET /saml/login` já não existia no callback:
 * com `InResponseTo` presente a resposta era recusada (o login iniciado pelo SP falhava sempre) e,
 * sem ele, era aceite — e podia ser reapresentada (com um RelayState novo) até expirar.
 *
 * Aqui a cache é partilhada (e sobrevive a várias instâncias da API):
 *  - os IDs de pedido são consumidos atomicamente (GETDEL) — de duas cópias da mesma resposta só
 *    uma passa;
 *  - cada assertion aceite fica registada até expirar (`SET NX`) — `rejectReplayedAssertions`.
 * Sem Redis falha fechado: não há login SAML sem anti-replay.
 */
export class CacheSamlRedis implements CacheProvider {
  constructor(
    private readonly redis: RedisService,
    private readonly ttlSegundos = 10 * 60,
    private readonly prefixo = 'sso:saml:cache:',
  ) {}

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const item: CacheItem = { value, createdAt: Date.now() };
    const ok = await this.redis.setIfNotExists(this.prefixo + key, JSON.stringify(item), this.ttlSegundos);
    if (ok === null) throw new Error('SAML: Redis indisponível — o pedido não pode ser registado');
    return ok ? item : null;
  }

  async getAsync(key: string): Promise<string | null> {
    return this.valor(await this.redis.obterTexto(this.prefixo + key));
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) return null;
    return this.consumeAsync(key);
  }

  async consumeAsync(key: string): Promise<string | null> {
    return this.valor(await this.redis.consumir(this.prefixo + key));
  }

  async saveIfAbsentAsync(key: string, value: string, expiresAtMs: number): Promise<boolean> {
    const ttl = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
    const ok = await this.redis.setIfNotExists(`${this.prefixo}assertion:${key}`, value, ttl);
    if (ok === null) throw new Error('SAML: Redis indisponível — sem anti-replay não se aceita a assertion');
    return ok;
  }

  private valor(bruto: string | null): string | null {
    if (!bruto) return null;
    try { return (JSON.parse(bruto) as CacheItem).value ?? null; } catch { return null; }
  }
}
