/**
 * QA-25 — a suite unitária não sai para a rede.
 *
 * Um teste chamava de facto a API da Anthropic (só passava porque a chave era inválida e caía no
 * fallback): com uma chave válida no ambiente, enviava texto clínico para fora e gerava custos.
 * Aqui, qualquer pedido HTTP(S) para fora de localhost falha logo, com uma mensagem que aponta
 * para o problema. Os testes que querem o modelo real (RUN_LIVE_AI_EVAL=true) ficam de fora.
 */
import http from 'http';
import https from 'https';

const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function anfitriao(alvo: unknown): string | null {
  try {
    if (typeof alvo === 'string') return new URL(alvo).hostname;
    if (alvo instanceof URL) return alvo.hostname;
    if (alvo && typeof alvo === 'object') {
      const o = alvo as { url?: string; hostname?: string; host?: string };
      if (o.url) return new URL(o.url).hostname;
      return (o.hostname ?? o.host ?? 'localhost').split(':')[0];
    }
  } catch { /* URL inválido: deixa o próprio cliente falhar */ }
  return null;
}

function bloquear(origem: string, alvo: unknown): void {
  const host = anfitriao(alvo);
  if (host && !LOCAL.has(host)) {
    throw new Error(`QA-25: rede bloqueada nos testes unitários (${origem} → ${host}). Use um mock.`);
  }
}

if (process.env['RUN_LIVE_AI_EVAL'] !== 'true') {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    bloquear('fetch', input);
    return fetchOriginal(input, init);
  }) as typeof fetch;

  for (const [nome, mod] of [['http', http], ['https', https]] as const) {
    const request = mod.request.bind(mod);
    const get = mod.get.bind(mod);
    (mod as any).request = (alvo: unknown, ...resto: unknown[]) => { bloquear(`${nome}.request`, alvo); return (request as any)(alvo, ...resto); };
    (mod as any).get = (alvo: unknown, ...resto: unknown[]) => { bloquear(`${nome}.get`, alvo); return (get as any)(alvo, ...resto); };
  }
}
