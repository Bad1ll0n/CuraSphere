'use client';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

/**
 * Flags de funcionalidade resolvidas para o utilizador atual (rollout gradual, por role/serviço).
 * Fonte: GET /feature-flags/me. Cacheado ~1min — as flags mudam raramente.
 */
export function useFeatureFlags() {
  return useQuery<Record<string, boolean>>({
    queryKey: ['feature-flags', 'me'],
    queryFn: () => api.get('/feature-flags/me').then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Conveniência: `const novoFluxo = useFeatureFlag('novo-fluxo-transfusao');` */
export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags();
  return data?.[key] ?? false;
}
