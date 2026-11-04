/**
 * Token do terminal de quiosque (S-05 / F-03).
 *
 * Desde que as rotas do quiosque passaram a exigir o `QuiosqueGuard`, estas páginas faziam
 * todos os pedidos sem token — e recebiam 401 em todos: o quiosque não tirava senhas nem
 * fazia check-in, e o painel de chamada ficava vazio.
 *
 * O token chega uma vez, no link de provisionamento gerado em Configurações (`?token=`), e
 * fica guardado no próprio terminal: o quiosque volta a abrir sem o link e continua a
 * funcionar. Segue no cabeçalho `Authorization` e não no URL, para não ficar registado nos
 * logs de acesso do proxy a cada pedido — com a excepção do `EventSource`, que não aceita
 * cabeçalhos.
 */
const CHAVE = 'curasphere.quiosque.token';

export function obterTokenQuiosque(): string | null {
  if (typeof window === 'undefined') return null;
  const doLink = new URLSearchParams(window.location.search).get('token');
  try {
    if (doLink) {
      window.localStorage.setItem(CHAVE, doLink);
      return doLink;
    }
    return window.localStorage.getItem(CHAVE);
  } catch {
    // Armazenamento bloqueado: vale o token do link, se houver.
    return doLink;
  }
}

export function quiosqueFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = obterTokenQuiosque();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

/** Só para o `EventSource`, que não envia cabeçalhos. */
export function urlComTokenQuiosque(url: string): string {
  const token = obterTokenQuiosque();
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}
