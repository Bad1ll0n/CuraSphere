/**
 * Duplo do expo-secure-store em memória (ARQ-26). Recusa chaves com caracteres que o real não
 * aceita e valores acima de 2048 bytes, para os testes apanharem o que falharia no telemóvel.
 */
const memoria = new Map<string, string>();
const CHAVE_VALIDA = /^[A-Za-z0-9._-]+$/;

export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 0;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 1;
export type SecureStoreOptions = Record<string, unknown>;

export async function setItemAsync(chave: string, valor: string): Promise<void> {
  if (!CHAVE_VALIDA.test(chave)) throw new Error(`chave inválida: ${chave}`);
  if (Buffer.byteLength(valor, 'utf8') > 2048) throw new Error('valor acima de 2048 bytes');
  memoria.set(chave, valor);
}
export async function getItemAsync(chave: string): Promise<string | null> {
  return memoria.has(chave) ? (memoria.get(chave) as string) : null;
}
export async function deleteItemAsync(chave: string): Promise<void> {
  memoria.delete(chave);
}
export function __limpar(): void { memoria.clear(); }
export function __chaves(): string[] { return [...memoria.keys()]; }
