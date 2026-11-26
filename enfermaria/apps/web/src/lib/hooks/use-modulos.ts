'use client';
import { modulosDesligados } from '@org/shared';
import { useFeatureFlags } from './use-feature-flags';

/**
 * PROD-20 — ids dos módulos opcionais desligados nesta instalação (flag `modulo.<id>` a false).
 * Enquanto as flags carregam, nada está desligado: o menu não pisca para quem tem tudo ligado.
 */
export function useModulosDesligados(): Set<string> {
  const { data } = useFeatureFlags();
  return modulosDesligados(data);
}
