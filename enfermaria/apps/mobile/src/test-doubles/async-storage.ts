/**
 * Duplo do AsyncStorage em memória. Guarda strings, como o real, para que os testes
 * exercitem também a serialização — que é onde a fila perdia operações.
 */
const memoria = new Map<string, string>();

export default {
  async getItem(chave: string): Promise<string | null> {
    return memoria.has(chave) ? (memoria.get(chave) as string) : null;
  },
  async setItem(chave: string, valor: string): Promise<void> {
    memoria.set(chave, valor);
  },
  async removeItem(chave: string): Promise<void> {
    memoria.delete(chave);
  },
  __limpar(): void {
    memoria.clear();
  },
};
