import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_USERNAME = 'bio_username';
const KEY_PASSWORD = 'bio_password';

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

export async function guardarCredenciaisBiometricas(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_USERNAME, username);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
}

export async function obterCredenciaisBiometricas(): Promise<{ username: string; password: string } | null> {
  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_USERNAME),
    SecureStore.getItemAsync(KEY_PASSWORD),
  ]);
  if (!username || !password) return null;
  return { username, password };
}

export async function limparCredenciaisBiometricas(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_USERNAME).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PASSWORD).catch(() => {});
}
