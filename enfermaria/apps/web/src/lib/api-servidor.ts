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

/**
 * PERF-12 — o papel do utilizador, lido do JWT da sessão, só para escolher o que pré-carregar
 * (ex.: "os meus doentes" ou todos). Não é uma decisão de acesso: a assinatura não é verificada
 * aqui e a api continua a ser a autoridade. Sem sessão ou com um token ilegível → null.
 */
export async function papelDaSessao(): Promise<string | null> {
  const jar = await cookies();
  const sessao = jar.get('access_token')?.value;
  const corpo = sessao?.split('.')[1];
  if (!corpo) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as { role?: unknown };
    return typeof dados.role === 'string' ? dados.role : null;
  } catch {
    return null;
  }
}
