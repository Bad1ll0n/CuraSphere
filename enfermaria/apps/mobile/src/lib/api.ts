import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setMemToken(token: string | null) {
  memToken = token;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) sessionStorage.setItem('_tk', token);
      else sessionStorage.removeItem('_tk');
    }
  } catch {}
}

export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorized = cb;
}

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  let token = memToken;
  if (!token) {
    try {
      token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('_tk') : null;
      if (token) memToken = token;
    } catch {}
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      setMemToken(null);
      await AsyncStorage.multiRemove(['token', 'utilizador']);
      onUnauthorized?.(); // força logout no UI
    }
    return Promise.reject(err);
  },
);

export default api;
