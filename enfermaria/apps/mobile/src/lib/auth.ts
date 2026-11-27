import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Utilizador } from '@org/shared';
import api, { getMemRefresh, renovarSessao, setRefreshRodadoCallback, setSessaoTokens, temSessaoAtiva } from './api';
import { apagarCacheOffline, queryClient } from './query-client';
import { registarPushToken } from './notifications';

import {
  apagarCredenciaisAntigas, guardarSessaoBiometrica, lerSessaoBiometrica, limparCredenciaisBiometricas, temSessaoBiometrica,
} from './biometric';
import { registarFalhaSilenciosa } from './erros';
import { definirDonoDaFila, flushMutationQueue, getQueueLength } from './mutation-queue';
export type { Utilizador };

export type ResultadoLogin =
  | { tipo: 'ok'; utilizador: Utilizador }
  | { tipo: 'mfa'; desafio: string }
  | { tipo: 'mfa_setup' }
  | { tipo: 'password_expirada' };

let utilizadorAtual: Utilizador | null = null;

/** SEC-23: começa a sessão em memória (tokens) — nada de password nem de token em disco. */
async function iniciarSessao(data: { accessToken: string; refreshToken: string; utilizador: Utilizador }): Promise<Utilizador> {
  setSessaoTokens(data.accessToken, data.refreshToken);
  utilizadorAtual = data.utilizador;
  setRefreshRodadoCallback((novo) => {
    // A cópia protegida por biometria acompanha a rotação (o refresh antigo deixa de valer).
    temSessaoBiometrica().then((tem) => (tem ? guardarSessaoBiometrica(novo) : undefined))
      .catch((e) => registarFalhaSilenciosa('auth', e));
  });
  await definirDonoDaFila(data.utilizador.id);
  registarPushToken().catch((e) => registarFalhaSilenciosa('auth', e));
  return data.utilizador;
}

/**
 * SEC-23: o login trata os passos que a API pode pedir. Antes o mobile assumia sempre sucesso e
 * gravava um `accessToken` que a API nunca devolveu no corpo — o login falhava; e um papel clínico
 * com MFA (obrigatório para eles) não tinha como introduzir o código.
 */
export async function login(numeroFuncionario: string, password: string): Promise<ResultadoLogin> {
  const { data } = await api.post('/auth/login', { numeroFuncionario, password });
  if (data.mfaPendente) return { tipo: 'mfa', desafio: data.mfaChallengeToken };
  if (data.mfaSetupObrigatorio) return { tipo: 'mfa_setup' };
  if (data.passwordExpirada) return { tipo: 'password_expirada' };
  return { tipo: 'ok', utilizador: await iniciarSessao(data) };
}

export async function verificarMfa(desafio: string, codigo: string): Promise<ResultadoLogin> {
  const { data } = await api.post('/auth/mfa/verificar', { mfaChallengeToken: desafio, code: codigo });
  if (data.passwordExpirada) return { tipo: 'password_expirada' };
  return { tipo: 'ok', utilizador: await iniciarSessao(data) };
}

/** Entrar pela biometria: o sistema liberta o refresh token guardado e a sessão renova-se. */
export async function entrarComBiometria(): Promise<Utilizador | null> {
  const refresh = await lerSessaoBiometrica();
  if (!refresh) return null;
  try {
    const data = await renovarSessao(refresh);
    await guardarSessaoBiometrica(data.refreshToken);
    return await iniciarSessao(data);
  } catch (e) {
    // Sessão revogada ou expirada no servidor: a cópia já não serve.
    registarFalhaSilenciosa('auth', e);
    await limparCredenciaisBiometricas();
    return null;
  }
}

/** Ativa a entrada por biometria para a sessão em curso (guarda o refresh token, protegido). */
export async function ativarEntradaBiometrica(): Promise<boolean> {
  const refresh = getMemRefresh();
  if (!refresh) return false;
  await guardarSessaoBiometrica(refresh);
  return true;
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
    await api.post('/auth/logout', { refreshToken: getMemRefresh() });
  } catch { /* ignore — logout locally regardless */ }
  await definirDonoDaFila(null);
  queryClient.clear();
  // A cópia em disco da cache — dados de doentes — sai com a sessão (ver apagarCacheOffline).
  await apagarCacheOffline().catch((e) => registarFalhaSilenciosa('auth', e));
  setSessaoTokens(null, null);
  setRefreshRodadoCallback(null);
  utilizadorAtual = null;

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

/** O utilizador da sessão em curso (em memória), ou null. */
export async function getUtilizador(): Promise<Utilizador | null> {
  return temSessaoAtiva() ? utilizadorAtual : null;
}

/**
 * SEC-23: no arranque, apaga o que versões antigas deixavam no SecureStore — o access token e o
 * perfil (a sessão já não sobrevive ao fecho da app sem biometria) e a password da biometria.
 */
export async function limparPersistenciaAntiga(): Promise<void> {
  for (const k of ['token', 'utilizador']) await SecureStore.deleteItemAsync(k).catch((e) => registarFalhaSilenciosa('auth', e));
  await apagarCredenciaisAntigas();
  await apagarCacheOffline().catch((e) => registarFalhaSilenciosa('auth', e)); // ARQ-26: cache clínica em claro
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
