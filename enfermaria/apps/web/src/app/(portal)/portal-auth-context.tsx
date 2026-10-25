'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PortalUser {
  doenteId: string;
  nome: string;
}

interface PortalAuthCtx {
  user: PortalUser | null;
  /**
   * Substitui o antigo `token` do contexto. As páginas usavam a existência do token
   * como prova de sessão; agora o token é um cookie `httpOnly` que o JavaScript não vê,
   * por isso a prova de sessão passa a ser o `/portal/me` ter respondido.
   */
  autenticado: boolean;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<PortalAuthCtx | null>(null);

const API = `${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')}/v1`;

const METODOS_COM_ESTADO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * SEC-07: o token do portal deixou de viver em `localStorage` e passou a cookie
 * `httpOnly`, como o do pessoal. Um XSS no portal já não consegue lê-lo.
 *
 * A troca traz uma consequência que tem de ser tratada aqui: um cookie é enviado pelo
 * browser sozinho, em qualquer pedido, incluindo os que outro site provoque — ou seja,
 * o portal passa a estar exposto a CSRF, e o `CsrfMiddleware` da API passa a exigir
 * `X-CSRF-Token` em tudo o que mude estado. Sem esta parte, migrar o cookie partia
 * todos os POST do portal com 403.
 */
let csrfToken: string | null = null;

async function garantirCsrf(): Promise<void> {
  if (csrfToken) return;
  const r = await fetch(`${API}/csrf-token`, { credentials: 'include' });
  if (!r.ok) return;
  const data = await r.json().catch(() => null);
  if (data?.token) csrfToken = data.token as string;
}

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Já não há token em `localStorage` para inspeccionar: a única forma de saber se há
    // sessão é perguntar à API, que lê o cookie. Um 401 aqui é o estado normal de quem
    // ainda não entrou — não é erro e não deve limpar sessão nenhuma.
    fetch(`${API}/portal/me`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setUser({ doenteId: data.id, nome: data.nome });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, senha: string) => {
    await garantirCsrf();
    const r = await fetch(`${API}/portal/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({ email, senha }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.message ?? 'Credenciais inválidas');
    }
    // A resposta traz o cookie `portal_token`; o corpo é ignorado de propósito.
    const rMe = await fetch(`${API}/portal/me`, { credentials: 'include' });
    if (rMe.ok) {
      const data = await rMe.json();
      setUser({ doenteId: data.id, nome: data.nome });
    }
    router.push('/portal');
  };

  const logout = () => {
    // O cookie é `httpOnly`: só o servidor o pode apagar. Limpar o estado local sem
    // avisar a API deixaria a sessão viva no browser durante as 8 h seguintes.
    void garantirCsrf()
      .then(() =>
        fetch(`${API}/portal/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
        }),
      )
      .catch(() => undefined)
      .finally(() => {
        csrfToken = null;
        setUser(null);
        router.push('/portal/login');
      });
  };

  return (
    <Ctx.Provider value={{ user, autenticado: user !== null, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortalAuth deve ser usado dentro de PortalAuthProvider');
  return ctx;
}

/**
 * Chamada autenticada ao portal. O token já não é passado como argumento — viaja no
 * cookie `httpOnly`, que o browser envia com `credentials: 'include'`.
 */
export async function portalFetch(path: string, options?: RequestInit) {
  const metodo = (options?.method ?? 'GET').toUpperCase();
  if (METODOS_COM_ESTADO.has(metodo)) await garantirCsrf();

  const r = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.headers ?? {}),
      ...(METODOS_COM_ESTADO.has(metodo) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.message ?? `Erro ${r.status}`);
  }
  return r.json();
}
