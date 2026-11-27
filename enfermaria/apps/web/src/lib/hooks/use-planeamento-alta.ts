import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AltasProteladas, CatalogoPlaneamentoAlta, ResumoPlaneamentoAlta } from '@org/shared';
import api from '../api';

/** PROD-13 — planeamento de alta e continuidade de cuidados (react-query + contrato partilhado). */
const chaveResumo = (doenteId: string) => ['planeamento-alta', 'doente', doenteId] as const;

export function usePlaneamentoAlta(doenteId: string) {
  return useQuery<ResumoPlaneamentoAlta>({
    queryKey: chaveResumo(doenteId),
    queryFn: () => api.get(`/planeamento-alta/doente/${doenteId}`).then((r) => r.data),
    enabled: !!doenteId,
  });
}

export function useCatalogoPlaneamentoAlta() {
  return useQuery<CatalogoPlaneamentoAlta>({
    queryKey: ['planeamento-alta', 'catalogo'],
    queryFn: () => api.get('/planeamento-alta/catalogo').then((r) => r.data),
    staleTime: 30 * 60_000,
  });
}

export function useAltasProteladas(ativo = true) {
  return useQuery<AltasProteladas>({
    queryKey: ['planeamento-alta', 'altas-proteladas'],
    queryFn: () => api.get('/planeamento-alta/altas-proteladas').then((r) => r.data),
    enabled: ativo,
    staleTime: 5 * 60_000,
  });
}

/** Qualquer ação do planeamento invalida o resumo do doente e o indicador de altas proteladas. */
export function useAcaoPlaneamento<T>(doenteId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chaveResumo(doenteId) });
      qc.invalidateQueries({ queryKey: ['planeamento-alta', 'altas-proteladas'] });
    },
  });
}
