import axios from 'axios';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/v1`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const data = err.response?.data;
    const isBreakGlass =
      err.response?.status === 403 &&
      (data?.errorCode === 'BREAK_GLASS_REQUIRED' || data?.message?.includes('break_glass'));
    if (isBreakGlass && !err.config?._breakGlass) {
      const motivo = window.prompt(
        `Acesso break-glass requerido.\nEste doente pertence a outro serviço.\n\nJustifique o acesso (mín. 20 caracteres):`,
      );
      if (motivo && motivo.trim().length >= 20) {
        err.config._breakGlass = true;
        err.config.headers['X-Break-Glass-Reason'] = motivo.trim();
        return api(err.config);
      }
    }
    return Promise.reject(err);
  },
);

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
      original.url?.includes('/auth/login')
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
