import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { registarFalhaSilenciosa } from './erros';

/**
 * SEC-23 — entrada por biometria SEM guardar a password.
 *
 * Antes, "Entrar com biometria" guardava o número de funcionário e a **password em claro** no
 * SecureStore, e a biometria era só um `authenticateAsync` da app à frente da leitura — o item em
 * si não estava ligado à biometria. Agora guarda-se o **refresh token** da sessão, num item do
 * SecureStore com `requireAuthentication`: é o sistema (Keychain / Keystore) que só o liberta
 * depois de Face ID / impressão digital. O refresh token roda a cada uso, termina com o logout e
 * pode ser revogado no servidor; a password nunca sai da cabeça do profissional.
 */
// Nome da chave no SecureStore, não o valor guardado.
const KEY_SESSAO = 'sessao_biometrica'; // nosemgrep
const KEYS_ANTIGAS = ['bio_username', 'bio_password']; // nosemgrep

const OPCOES = {
  requireAuthentication: true,
  authenticationPrompt: 'Confirme a sua identidade para entrar',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
} as const;

export async function biometriaDisponivel(): Promise<boolean> {
  const suporta = await LocalAuthentication.hasHardwareAsync();
  const inscrito = await LocalAuthentication.isEnrolledAsync();
  return suporta && inscrito;
}

export async function autenticarComBiometria(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Autenticar com biometria',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar password',
  });
  return result.success;
}

/** Há uma sessão guardada para entrar por biometria? (não pede biometria: só verifica). */
export async function temSessaoBiometrica(): Promise<boolean> {
  try {
    // A existência marca-se num item sem biometria; o token está no item protegido.
    return (await SecureStore.getItemAsync(`${KEY_SESSAO}_existe`)) === '1';
  } catch { return false; }
}

export async function guardarSessaoBiometrica(refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SESSAO, refreshToken, OPCOES);
  await SecureStore.setItemAsync(`${KEY_SESSAO}_existe`, '1');
}

/** Pede a biometria ao sistema e devolve o refresh token guardado (null se cancelado ou inválido). */
export async function lerSessaoBiometrica(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_SESSAO, OPCOES);
  } catch (e) {
    // Biometria alterada (nova impressão digital) invalida o item: limpa e pede a password.
    registarFalhaSilenciosa('biometric', e);
    await limparCredenciaisBiometricas();
    return null;
  }
}

export async function limparCredenciaisBiometricas(): Promise<void> {
  for (const k of [KEY_SESSAO, `${KEY_SESSAO}_existe`, ...KEYS_ANTIGAS]) {
    await SecureStore.deleteItemAsync(k).catch((e) => registarFalhaSilenciosa('biometric', e));
  }
}

/** Instalações antigas tinham a password guardada: apaga-a no arranque. */
export async function apagarCredenciaisAntigas(): Promise<void> {
  for (const k of KEYS_ANTIGAS) await SecureStore.deleteItemAsync(k).catch((e) => registarFalhaSilenciosa('biometric', e));
}
