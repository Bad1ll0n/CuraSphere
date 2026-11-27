import axios from 'axios';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/v1`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

let csrfToken: string | null = null;

export async function initCsrf(): Promise<void> {
  if (csrfToken) return;
  try {
    const r = await axios.get(`${API_BASE}/csrf-token`, { withCredentials: true });
    csrfToken = r.data.token as string;
  } catch { /* non-critical — server may not require CSRF in dev */ }
}

const STATEFUL_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// O token CSRF era obtido só pelo layout do dashboard: numa página fora dele aberta por link ou
// recarregada (teleconsulta, impressão, quiosque…), as escritas saíam sem token e davam 403 — o
// "Terminar" da teleconsulta falhava em silêncio e a chamada ficava aberta (encontrado pelo E2E,
// QA-23). Agora o primeiro pedido com escrita obtém-no, em qualquer página.
api.interceptors.request.use(async (config) => {
  if (STATEFUL_METHODS.has(config.method ?? '')) {
    if (!csrfToken) await initCsrf();
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// UX-10 / ARQ-28: o break-glass deixou de ser um `window.prompt` aqui dentro (falhava em browsers
// embutidos e abria um diálogo por cada pedido da ficha). O 403 BREAK_GLASS_REQUIRED segue para o
// ecrã, que mostra "Não está atribuído a este doente" com "Pedir atribuição" e "Acesso de
// emergência" (components/sem-acesso-doente.tsx); concedido o acesso, a ficha volta a carregar.

let refreshingToken = false;
let refreshSubscribers: (() => void)[] = [];

function onRefreshed() {
  refreshSubscribers.forEach(cb => cb());
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (
      err.response?.status !== 401 ||
      typeof window === 'undefined' ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login') ||
      // UX-21: no desbloqueio do posto, 401 é password errada — renovar e repetir contava a
      // mesma tentativa duas vezes no bloqueio por falhas.
      original.url?.includes('/auth/desbloquear') ||
      original.url?.includes('/auth/me')
    ) {
      return Promise.reject(err);
    }

    if (refreshingToken) {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push(() => resolve(api(original)));
        setTimeout(() => reject(err), 10000);
      });
    }

    original._retry = true;
    refreshingToken = true;

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/v1/auth/refresh`,
        {},
        { withCredentials: true },
      );
      onRefreshed();
      return api(original);
    } catch {
      refreshSubscribers = [];
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      refreshingToken = false;
    }
  },
);

export default api;
