import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export function setMemToken(token: string | null) {
  memToken = token;
}

export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorized = cb;
}

const api = axios.create({ baseURL: `${API_URL}/v1` });

api.interceptors.request.use((config) => {
  if (memToken) config.headers.Authorization = `Bearer ${memToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/v1/auth/refresh`, {}, { withCredentials: true });
      const newToken: string = data.accessToken;
      setMemToken(newToken);
      await SecureStore.setItemAsync('token', newToken);
      refreshQueue.forEach((resolve) => resolve(newToken));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      refreshQueue = [];
      setMemToken(null);
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('utilizador');
      onUnauthorized?.();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
