'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PortalUser {
  doenteId: string;
  nome: string;
}

interface PortalAuthCtx {
  user: PortalUser | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<PortalAuthCtx | null>(null);

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api').replace(/\/$/, '');

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('portal_token');
    if (t) {
      setToken(t);
      fetchMe(t);
    }
  }, []);

  const fetchMe = async (t: string) => {
    try {
      const r = await fetch(`${API}/portal/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) { logout(); return; }
      const data = await r.json();
      setUser({ doenteId: data.id, nome: data.nome });
    } catch {
      logout();
    }
  };

  const login = async (email: string, senha: string) => {
    const r = await fetch(`${API}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.message ?? 'Credenciais inválidas');
    }
    const { accessToken } = await r.json();
    localStorage.setItem('portal_token', accessToken);
    setToken(accessToken);
    await fetchMe(accessToken);
    router.push('/portal');
  };

  const logout = () => {
    localStorage.removeItem('portal_token');
    setToken(null);
    setUser(null);
    router.push('/portal/login');
  };

  return <Ctx.Provider value={{ user, token, login, logout }}>{children}</Ctx.Provider>;
}

export function usePortalAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortalAuth deve ser usado dentro de PortalAuthProvider');
  return ctx;
}

export async function portalFetch(path: string, token: string, options?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.message ?? `Erro ${r.status}`);
  }
  return r.json();
}
