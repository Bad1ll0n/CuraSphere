import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import { CacheSamlRedis } from './saml-cache';

/** RedisService falso (Map com as mesmas semânticas: NX, GETDEL, indisponível → null). */
function redisFalso() {
  const m = new Map<string, string>();
  let ligado = true;
  return {
    m,
    desligar: () => { ligado = false; },
    setIfNotExists: async (k: string, v: string) => { if (!ligado) return null; if (m.has(k)) return false; m.set(k, v); return true; },
    obterTexto: async (k: string) => (ligado ? m.get(k) ?? null : null),
    consumir: async (k: string) => { if (!ligado) return null; const v = m.get(k) ?? null; m.delete(k); return v; },
  };
}

const CERT = 'MIIC'; // só é usado para validar respostas — aqui não se valida nenhuma

const saml = (cache: CacheSamlRedis) => new SAML({
  idpCert: CERT, issuer: 'curasphere', callbackUrl: 'http://localhost/cb', entryPoint: 'https://idp.example/sso',
  wantAssertionsSigned: true, validateInResponseTo: ValidateInResponseTo.always, rejectReplayedAssertions: true, cacheProvider: cache,
});

describe('CacheSamlRedis (SEC-06)', () => {
  it('o ID do pedido gravado no login é encontrado pelo callback, noutra instância SAML', async () => {
    const r = redisFalso();
    const url = await saml(new CacheSamlRedis(r as any)).getAuthorizeUrlAsync('relay', undefined, {});
    expect(url).toContain('https://idp.example/sso');

    const [chave] = [...r.m.keys()];
    expect(chave).toMatch(/^sso:saml:cache:_/);
    const id = chave.replace('sso:saml:cache:', '');
    // A instância do callback é outra — antes a cache era em memória da primeira e perdia-se.
    const doCallback = new CacheSamlRedis(r as any);
    expect(await doCallback.getAsync(id)).not.toBeNull();
  });

  it('cada ID de pedido só se consome uma vez', async () => {
    const c = new CacheSamlRedis(redisFalso() as any);
    await c.saveAsync('_abc', '2026-01-01T00:00:00Z');
    expect(await c.consumeAsync('_abc')).toBe('2026-01-01T00:00:00Z');
    expect(await c.consumeAsync('_abc')).toBeNull();
    expect(await c.removeAsync(null)).toBeNull();
  });

  it('uma assertion já aceite é recusada da segunda vez (anti-replay)', async () => {
    const c = new CacheSamlRedis(redisFalso() as any);
    const ate = Date.now() + 60_000;
    expect(await c.saveIfAbsentAsync('_assert1', 'x', ate)).toBe(true);
    expect(await c.saveIfAbsentAsync('_assert1', 'x', ate)).toBe(false);
  });

  it('sem Redis falha fechado (não grava pedidos nem aceita assertions)', async () => {
    const r = redisFalso();
    r.desligar();
    const c = new CacheSamlRedis(r as any);
    await expect(c.saveAsync('_x', 'v')).rejects.toThrow(/Redis indisponível/);
    await expect(c.saveIfAbsentAsync('_a', 'v', Date.now() + 1000)).rejects.toThrow(/anti-replay/);
    expect(await c.consumeAsync('_x')).toBeNull();
  });
});
