import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConjuntoCuidadosResumo, ItemCatalogoCuidados, PlanoCuidados } from '@org/shared';
import api from '../api';
import { chavesClinicas } from './chaves-clinicas';

/**
 * PROD-07 — plano de cuidados de enfermagem (react-query + contrato partilhado com a api).
 * Qualquer alteração invalida o plano do doente e "O meu turno" (registos devidos).
 */
const chavePlano = (doenteId: string) => ['processo-enfermagem', 'plano', doenteId] as const;

export function usePlanoCuidados(doenteId: string) {
  return useQuery<PlanoCuidados>({
    queryKey: chavePlano(doenteId),
    queryFn: () => api.get(`/processo-enfermagem/doente/${doenteId}/plano`).then((r) => r.data),
    enabled: !!doenteId,
    refetchInterval: 120_000,
  });
}

export function useAvaliacaoInicial(doenteId: string, ativa: boolean) {
  return useQuery<{ dados: Record<string, unknown>; completa: boolean } | null>({
    queryKey: ['processo-enfermagem', 'avaliacao-inicial', doenteId],
    queryFn: () => api.get(`/processo-enfermagem/doente/${doenteId}/avaliacao-inicial`).then((r) => r.data || null),
    enabled: !!doenteId && ativa,
  });
}

export function useCatalogoCuidados(tipo: 'diagnostico' | 'intervencao') {
  return useQuery<ItemCatalogoCuidados[]>({
    queryKey: ['processo-enfermagem', 'catalogo', tipo],
    queryFn: () => api.get('/processo-enfermagem/catalogo', { params: { tipo } }).then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

export function useConjuntosCuidados() {
  return useQuery<ConjuntoCuidadosResumo[]>({
    queryKey: ['processo-enfermagem', 'conjuntos'],
    queryFn: () => api.get('/processo-enfermagem/conjuntos').then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

/** Uma mutação do plano: faz o pedido e invalida o plano e "O meu turno". */
export function useAcaoPlano<T>(doenteId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chavePlano(doenteId) });
      qc.invalidateQueries({ queryKey: ['processo-enfermagem', 'avaliacao-inicial', doenteId] });
      qc.invalidateQueries({ queryKey: chavesClinicas.meuTurno });
    },
  });
}
