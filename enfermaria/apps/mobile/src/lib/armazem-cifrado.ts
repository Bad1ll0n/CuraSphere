import * as SecureStore from 'expo-secure-store';

/**
 * ARQ-26 — o conteúdo clínico da fila offline (administrações, sinais vitais, notas) ficava em
 * claro no AsyncStorage: num telemóvel perdido, rooted ou com backup não cifrado, lia-se tudo.
 * Agora cada operação vai para o SecureStore (Keychain no iOS, Keystore no Android: cifrado com
 * uma chave do hardware, só neste aparelho e com o ecrã desbloqueado uma vez).
 *
 * O SecureStore aceita só chaves [A-Za-z0-9._-] e recomenda valores até 2048 bytes. Cada valor
 * é guardado em blocos (`<chave>.0`, `<chave>.1`, …) com o número de blocos em `<chave>.n`.
 */
const MAX_BYTES_BLOCO = 2000; // abaixo dos 2048 bytes do SecureStore

/** Bytes de um ponto de código em UTF-8. */
const bytesUtf8 = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/**
 * Divide por bytes UTF-8, não por caracteres: o texto clínico tem acentos (2 bytes) e um corte
 * por caracteres passava dos 2048 bytes. Nunca parte um ponto de código (emoji, pares).
 */
export function dividirEmBlocos(valor: string): string[] {
  const blocos: string[] = [];
  let atual = '';
  let bytes = 0;
  for (const ch of valor) {
    const b = bytesUtf8(ch.codePointAt(0) as number);
    if (bytes + b > MAX_BYTES_BLOCO) { blocos.push(atual); atual = ''; bytes = 0; }
    atual += ch;
    bytes += b;
  }
  blocos.push(atual);
  return blocos;
}
const OPCOES: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const chaveSegura = (chave: string) => chave.replace(/[^A-Za-z0-9._-]/g, '_');

export async function guardarCifrado(chave: string, valor: string): Promise<void> {
  const k = chaveSegura(chave);
  const antes = Number(await SecureStore.getItemAsync(`${k}.n`, OPCOES)) || 0;
  const blocos = dividirEmBlocos(valor);
  for (let i = 0; i < blocos.length; i++) await SecureStore.setItemAsync(`${k}.${i}`, blocos[i], OPCOES);
  // O número de blocos escreve-se no fim: uma escrita interrompida deixa o valor antigo legível.
  await SecureStore.setItemAsync(`${k}.n`, String(blocos.length), OPCOES);
  for (let i = blocos.length; i < antes; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPCOES);
}

export async function lerCifrado(chave: string): Promise<string | null> {
  const k = chaveSegura(chave);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, OPCOES));
  if (!n) return null;
  const partes: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await SecureStore.getItemAsync(`${k}.${i}`, OPCOES);
    if (p == null) return null; // incompleto: tratado como ausente (a fila descarta-o do índice)
    partes.push(p);
  }
  return partes.join('');
}

export async function apagarCifrado(chave: string): Promise<void> {
  const k = chaveSegura(chave);
  const n = Number(await SecureStore.getItemAsync(`${k}.n`, OPCOES)) || 0;
  await SecureStore.deleteItemAsync(`${k}.n`, OPCOES);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, OPCOES);
}
