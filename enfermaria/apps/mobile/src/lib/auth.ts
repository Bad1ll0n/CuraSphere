import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setMemToken } from './api';

export interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  role: string;
}

export async function login(numeroFuncionario: string, password: string): Promise<Utilizador> {
  const { data } = await api.post('/auth/login', { numeroFuncionario, password });
  setMemToken(data.accessToken);
  await AsyncStorage.setItem('token', data.accessToken);
  await AsyncStorage.setItem('utilizador', JSON.stringify(data.utilizador));
  return data.utilizador;
}

export async function logout() {
  setMemToken(null);
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('utilizador');
}

export async function getUtilizador(): Promise<Utilizador | null> {
  const [stored, token] = await Promise.all([
    AsyncStorage.getItem('utilizador'),
    AsyncStorage.getItem('token'),
  ]);
  // Sem token = sessão inválida, força novo login
  if (!stored || !token) {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('utilizador');
    return null;
  }
  setMemToken(token);
  return JSON.parse(stored);
}
