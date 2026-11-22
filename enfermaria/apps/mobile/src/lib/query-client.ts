import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ARQ-26 — a cache de leitura (doentes, vitais, medicação…) fica **só em memória**.
 *
 * Antes era persistida em claro no AsyncStorage (`curasphere:query_cache`) durante 24 h: num
 * dispositivo partilhado, os dados clínicos ficavam em disco, legíveis com acesso ao aparelho.
 * Desde o SEC-23 a sessão também não sobrevive ao fecho da app (só a entrada por biometria a
 * retoma, e com rede), por isso a cópia em disco já não servia a ninguém — só ao risco. Durante
 * a sessão, a cache em memória continua a servir o trabalho sem rede; os registos feitos offline
 * vão pela fila (mutation-queue), que essa sim tem de sobreviver.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 12 * 60 * 60_000, // um turno: a cache em memória cobre as quebras de rede
      retry: 1,
    },
  },
});

/** Chave da cópia em disco das versões antigas. */
const CHAVE_CACHE_ANTIGA = 'curasphere:query_cache';

/** Apaga a cache em disco que versões antigas deixaram (no arranque e no logout). */
export async function apagarCacheOffline(): Promise<void> {
  await AsyncStorage.removeItem(CHAVE_CACHE_ANTIGA);
}
