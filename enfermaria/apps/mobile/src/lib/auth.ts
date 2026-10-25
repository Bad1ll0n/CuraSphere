import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Utilizador } from '@org/shared';
import api, { setMemToken } from './api';
import { apagarCacheOffline, queryClient } from './query-client';
import { registarPushToken } from './notifications';

import { limparCredenciaisBiometricas } from './biometric';
import { registarFalhaSilenciosa } from './erros';
import { definirDonoDaFila, flushMutationQueue, getQueueLength } from './mutation-queue';
export type { Utilizador };

export async function login(numeroFuncionario: string, password: string): Promise<Utilizador> {
  const { data } = await api.post('/auth/login', { numeroFuncionario, password });
  setMemToken(data.accessToken);
  await SecureStore.setItemAsync('token', data.accessToken);
  await SecureStore.setItemAsync('utilizador', JSON.stringify(data.utilizador));
  await definirDonoDaFila(data.utilizador.id);
  // Registar push token de forma não-bloqueante após login
  registarPushToken().catch((e) => registarFalhaSilenciosa('auth', e));
  return data.utilizador;
}

// Sem rede, cada pedido pode demorar até ao timeout: a saída não fica refém disso.
const LIMITE_ENVIO_NA_SAIDA_MS = 8_000;

let saidaEmCurso: Promise<void> | null = null;

export function logout(): Promise<void> {
  // O envio da fila pode receber um 401 e o interceptor da API reagir terminando a sessão:
  // uma segunda chamada a meio junta-se a esta, em vez de começar outra.
  if (saidaEmCurso) return saidaEmCurso;
  saidaEmCurso = terminarSessao().finally(() => { saidaEmCurso = null; });
  return saidaEmCurso;
}

async function terminarSessao(): Promise<void> {
  // A9: o que está na fila offline é de quem está a sair. Tenta-se enviar ANTES de a sessão
  // terminar, com o token dessa pessoa. O que não passar fica guardado e só volta a seguir
  // quando ela própria entrar — nunca com a sessão de quem vier a seguir. Um envio que fique
  // a meio do limite pára sozinho quando o dono deixa de ser a sessão activa.
  await Promise.race([
    flushMutationQueue().catch((e) => registarFalhaSilenciosa('auth', e)),
    new Promise((resolver) => setTimeout(resolver, LIMITE_ENVIO_NA_SAIDA_MS)),
  ]);

  try {
    await api.post('/auth/logout');
  } catch { /* ignore — logout locally regardless */ }
  await definirDonoDaFila(null);
  queryClient.clear();
  // A cópia em disco da cache — dados de doentes — sai com a sessão (ver apagarCacheOffline).
  await apagarCacheOffline().catch((e) => registarFalhaSilenciosa('auth', e));
  setMemToken(null);
  await SecureStore.deleteItemAsync('token').catch((e) => registarFalhaSilenciosa('auth', e));
  await SecureStore.deleteItemAsync('utilizador').catch((e) => registarFalhaSilenciosa('auth', e));

  // MB-08: as credenciais biométricas têm de sair com a sessão. Este é um dispositivo
  // partilhado entre turnos: deixá-las guardadas faz com que o enfermeiro seguinte entre
  // com a identidade do anterior, e os actos clínicos fiquem atribuídos à pessoa errada.
  // A função de limpeza já existia — simplesmente nunca era chamada de lado nenhum.
  await limparCredenciaisBiometricas();
}

/** Texto da confirmação de saída: avisa quando ficam registos por enviar. */
export async function mensagemDeSaida(): Promise<string> {
  const pendentes = await getQueueLength().catch(() => 0);
  if (pendentes === 0) return 'Tem a certeza que quer sair?';
  const registos = pendentes === 1 ? '1 registo' : `${pendentes} registos`;
  return (
    `Tem ${registos} por sincronizar. Vamos tentar enviá-los agora; o que não passar fica ` +
    'guardado neste dispositivo e só é enviado quando voltar a entrar.'
  );
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
  const utilizador: Utilizador = JSON.parse(stored);
  await definirDonoDaFila(utilizador.id);
  return utilizador;
}

/**
 * Utilizador autenticado, para consumo a partir de um componente.
 * `DocumentosScreen` já importava este hook, mas ele nunca chegou a existir — o ecrã
 * simplesmente não compilava. Lê a sessão guardada uma vez, à montagem.
 */
export function useAuth() {
  const [user, setUser] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    getUtilizador()
      .then((u) => { if (activo) setUser(u); })
      .catch(() => { if (activo) setUser(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  return { user, loading };
}
