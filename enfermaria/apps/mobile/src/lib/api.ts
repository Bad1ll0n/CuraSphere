import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

/**
 * SEC-23 — sessão nativa. A app identifica-se com `X-Cliente: mobile`: a API devolve os tokens no
 * corpo (não em cookie, que não serve a uma app e esbarrava no CSRF) e o refresh token vai no
 * corpo do `/auth/refresh`. Os dois tokens vivem **em memória**; a única cópia persistida é a do
 * refresh token protegida por biometria (ver biometric.ts), que só existe se o profissional a ativar.
 */
export const CABECALHO_CLIENTE = { 'X-Cliente': 'mobile' } as const;

let memToken: string | null = null;
let memRefresh: string | null = null;
let onUnauthorized: (() => void) | null = null;
let onRefreshRodado: ((refreshToken: string) => void) | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export function setMemToken(token: string | null) {
  memToken = token;
}

export function setSessaoTokens(accessToken: string | null, refreshToken: string | null) {
  memToken = accessToken;
  memRefresh = refreshToken;
}

export function getMemRefresh(): string | null {
  return memRefresh;
}

export function temSessaoAtiva(): boolean {
  return memToken !== null;
}

export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorized = cb;
}

/** Chamado quando o refresh token roda — para atualizar a cópia protegida por biometria. */
export function setRefreshRodadoCallback(cb: ((refreshToken: string) => void) | null) {
  onRefreshRodado = cb;
}

/** Troca um refresh token por tokens novos (o servidor roda-o: o antigo deixa de valer). */
export async function renovarSessao(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; utilizador: any }> {
  const { data } = await axios.post(`${API_URL}/v1/auth/refresh`, { refreshToken }, { headers: CABECALHO_CLIENTE });
  return data;
}

const api = axios.create({ baseURL: `${API_URL}/v1`, headers: CABECALHO_CLIENTE });

api.interceptors.request.use((config) => {
  if (memToken) config.headers.Authorization = `Bearer ${memToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const url: string = original?.url ?? '';
    // Um 401 no login, no MFA ou no desbloqueio é "credenciais erradas", não sessão expirada.
    if (err.response?.status !== 401 || original._retry || /\/auth\/(login|mfa\/verificar|refresh)/.test(url)) {
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      }).then((token) => {
        if (!token) return Promise.reject(err);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      if (!memRefresh) throw new Error('sem refresh token');
      const data = await renovarSessao(memRefresh);
      setSessaoTokens(data.accessToken, data.refreshToken);
      onRefreshRodado?.(data.refreshToken);
      refreshQueue.forEach((resolve) => resolve(data.accessToken));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch {
      refreshQueue.forEach((resolve) => resolve(null));
      refreshQueue = [];
      setSessaoTokens(null, null);
      onUnauthorized?.();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
