/**
 * PERF-12 — leitura da api no servidor (Server Components), com a sessão do utilizador.
 *
 * Só para importar em Server Components. Reenvia o cookie da sessão (`access_token`, httpOnly)
 * à api, para que o primeiro HTML já traga os dados e o ecrã não espere pela hidratação + um
 * segundo pedido. Qualquer falha (sessão expirada, api lenta, rede) lança erro: o
 * `prefetchQuery` engole-o e o ecrã faz o pedido normal no browser — nunca fica pior do que
 * estava.
 *
 * `API_INTERNAL_URL` permite, em produção, falar com a api pela rede interna (ex.: Docker)
 * em vez de dar a volta pelo endereço público.
 */
import { cookies } from 'next/headers';

const BASE = process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3333';
const TEMPO_MAXIMO_MS = 2500;

export async function buscarNoServidor<T>(caminho: string): Promise<T> {
  if (!caminho.startsWith('/')) throw new Error('caminho inválido');
  const jar = await cookies();
  const sessao = jar.get('access_token')?.value;
  if (!sessao) throw new Error('sem sessão');
  const r = await fetch(`${BASE.replace(/\/$/, '')}/v1${caminho}`, {
    headers: { cookie: `access_token=${sessao}`, accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
  });
  if (!r.ok) throw new Error(`api ${r.status}`);
  return (await r.json()) as T;
}
