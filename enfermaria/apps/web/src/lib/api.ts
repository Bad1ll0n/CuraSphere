import axios from 'axios';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/v1`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

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
