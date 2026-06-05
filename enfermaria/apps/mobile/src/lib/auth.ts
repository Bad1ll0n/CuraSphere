import * as SecureStore from 'expo-secure-store';
import { Utilizador } from '@org/shared';
import api, { setMemToken } from './api';
import { queryClient } from './query-client';
import { registarPushToken } from './notifications';

export type { Utilizador };

export async function login(numeroFuncionario: string, password: string): Promise<Utilizador> {
  const { data } = await api.post('/auth/login', { numeroFuncionario, password });
  setMemToken(data.accessToken);
  await SecureStore.setItemAsync('token', data.accessToken);
  await SecureStore.setItemAsync('utilizador', JSON.stringify(data.utilizador));
  // Registar push token de forma não-bloqueante após login
  registarPushToken().catch(() => {});
  return data.utilizador;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch { /* ignore — logout locally regardless */ }
  queryClient.clear();
  setMemToken(null);
  await SecureStore.deleteItemAsync('token').catch(() => {});
  await SecureStore.deleteItemAsync('utilizador').catch(() => {});
}

export async function getUtilizador(): Promise<Utilizador | null> {
  const [stored, token] = await Promise.all([
    SecureStore.getItemAsync('utilizador'),
    SecureStore.getItemAsync('token'),
  ]);
  if (!stored || !token) {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('utilizador');
    return null;
  }
  setMemToken(token);
  return JSON.parse(stored);
}
