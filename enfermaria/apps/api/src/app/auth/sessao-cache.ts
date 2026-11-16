/**
 * SEC-04: cache curta do estado de sessão de cada utilizador (`versaoSessao` + `ativo`),
 * lida pela `JwtStrategy` em cada pedido autenticado.
 *
 * Sem cache seria uma leitura à BD por pedido; com ela, a revogação demora no máximo
 * `TTL_MS` a chegar às OUTRAS instâncias da API. Na instância que revoga é imediata,
 * porque `terminarSessoes` chama `invalidarCacheSessao`.
 */
export interface EstadoSessao {
  versaoSessao: number;
  ativo: boolean;
}

export const TTL_CACHE_SESSAO_MS = 10_000;
const MAX_ENTRADAS = 10_000;

const cache = new Map<string, { estado: EstadoSessao; expiraEm: number }>();

export function lerCacheSessao(utilizadorId: string, agora = Date.now()): EstadoSessao | undefined {
  const e = cache.get(utilizadorId);
  if (!e) return undefined;
  if (e.expiraEm <= agora) {
    cache.delete(utilizadorId);
    return undefined;
  }
  return e.estado;
}

export function gravarCacheSessao(utilizadorId: string, estado: EstadoSessao, agora = Date.now()): void {
  if (cache.size >= MAX_ENTRADAS) cache.clear();
  cache.set(utilizadorId, { estado, expiraEm: agora + TTL_CACHE_SESSAO_MS });
}

/**
 * ARQ-17/OPS-09: com várias réplicas, a revogação tem de chegar a TODAS já, e não ao fim do
 * TTL. `SessaoCacheSincronizacao` liga aqui o barramento (Redis); sem ele, só a local.
 */
let difundir: ((utilizadorId: string) => void) | null = null;
export function ligarDifusaoSessao(fn: ((utilizadorId: string) => void) | null): void {
  difundir = fn;
}

/** Apaga só nesta réplica (usado ao receber a difusão das outras). */
export function apagarCacheSessaoLocal(utilizadorId: string): void {
  cache.delete(utilizadorId);
}

export function invalidarCacheSessao(utilizadorId: string): void {
  cache.delete(utilizadorId);
  difundir?.(utilizadorId);
}

/** Só para testes. */
export function limparCacheSessao(): void {
  cache.clear();
}
