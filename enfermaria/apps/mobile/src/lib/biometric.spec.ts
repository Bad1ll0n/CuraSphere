import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  apagarCredenciaisAntigas, guardarSessaoBiometrica, lerSessaoBiometrica, limparCredenciaisBiometricas, temSessaoBiometrica,
} from './biometric';

const mockGuardado = new Map<string, { valor: string; opcoes?: Record<string, unknown> }>();
jest.mock('expo-secure-store', () => ({
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(async (k: string, valor: string, opcoes?: Record<string, unknown>) => { mockGuardado.set(k, { valor, opcoes }); }),
  getItemAsync: jest.fn(async (k: string) => mockGuardado.get(k)?.valor ?? null),
  deleteItemAsync: jest.fn(async (k: string) => { mockGuardado.delete(k); }),
}), { virtual: true });
jest.mock('expo-local-authentication', () => ({}), { virtual: true });
jest.mock('./erros', () => ({ registarFalhaSilenciosa: jest.fn() }));


describe('entrada por biometria (SEC-23)', () => {
  beforeEach(() => mockGuardado.clear());

  it('guarda o refresh token num item que o sistema só liberta com biometria', async () => {
    await guardarSessaoBiometrica('refresh-123');
    const item = mockGuardado.get('sessao_biometrica');
    expect(item?.valor).toBe('refresh-123');
    expect(item?.opcoes).toMatchObject({ requireAuthentication: true, keychainAccessible: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY' });
    expect(await temSessaoBiometrica()).toBe(true);
    expect(await lerSessaoBiometrica()).toBe('refresh-123');
  });

  it('a password de instalações antigas é apagada; o logout limpa tudo', async () => {
    mockGuardado.set('bio_username', { valor: '00003' });
    mockGuardado.set('bio_password', { valor: 'a-password-em-claro' });
    await apagarCredenciaisAntigas();
    expect(mockGuardado.has('bio_password')).toBe(false);
    await guardarSessaoBiometrica('r');
    await limparCredenciaisBiometricas();
    expect([...mockGuardado.keys()]).toEqual([]);
  });

  it('nenhum ficheiro da app guarda uma password no SecureStore', () => {
    const raiz = join(__dirname, '..');
    const ficheiros = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? ficheiros(join(d, e.name)) : /\.tsx?$/.test(e.name) && !e.name.includes('.spec.') ? [join(d, e.name)] : []);
    const ofensores = ficheiros(raiz).filter((f) => /setItemAsync\([^)]*(password|senha)/i.test(readFileSync(f, 'utf8')));
    expect(ofensores).toEqual([]);
  });
});
