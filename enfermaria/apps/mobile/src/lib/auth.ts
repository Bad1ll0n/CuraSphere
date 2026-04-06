import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  role: string;
}

export async function login(numeroFuncionario: string, password: string): Promise<Utilizador> {
  const { data } = await api.post('/auth/login', { numeroFuncionario, password });
  await AsyncStorage.setItem('token', data.accessToken);
  await AsyncStorage.setItem('utilizador', JSON.stringify(data.utilizador));
  return data.utilizador;
}

export async function logout() {
  await AsyncStorage.multiRemove(['token', 'utilizador']);
}

export async function getUtilizador(): Promise<Utilizador | null> {
  const stored = await AsyncStorage.getItem('utilizador');
  return stored ? JSON.parse(stored) : null;
}
