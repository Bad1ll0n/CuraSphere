import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EtiquetaUnidose, FaixaDoente, MeuTurno, PulseiraDoente } from '@org/shared';
import api from '../api';

/**
 * ARQ-12 / ARQ-13 — dados clínicos do turno lidos por react-query, com os tipos do contrato
 * partilhado com a api (`@org/shared`). Uma única chave por recurso: administrar no MAR
 * invalida "O meu turno" e a faixa do doente, em vez de cada ecrã ter o seu `setInterval`.
 */
export const chavesClinicas = {
  meuTurno: ['resumo', 'meu-turno'] as const,
  faixa: (doenteId: string) => ['resumo', 'faixa', doenteId] as const,
  pulseira: (doenteId: string) => ['resumo', 'pulseira', doenteId] as const,
  etiqueta: (medicacaoId: string) => ['medicacao', 'etiqueta', medicacaoId] as const,
  mar: ['medicacao', 'mar'] as const,
};

export function useMeuTurno() {
  return useQuery<MeuTurno>({
    queryKey: chavesClinicas.meuTurno,
    queryFn: () => api.get('/resumo/meu-turno').then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useFaixaDoente(doenteId: string) {
  return useQuery<FaixaDoente>({
    queryKey: chavesClinicas.faixa(doenteId),
    queryFn: () => api.get(`/resumo/doente/${doenteId}/faixa`).then((r) => r.data),
    enabled: !!doenteId,
    refetchInterval: 60_000,
  });
}

export function usePulseira(doenteId: string) {
  return useQuery<PulseiraDoente>({
    queryKey: chavesClinicas.pulseira(doenteId),
    queryFn: () => api.get(`/resumo/doente/${doenteId}/pulseira`).then((r) => r.data),
    enabled: !!doenteId,
  });
}

/** A etiqueta traz um carimbo de emissão: nunca vem da cache. */
export function useEtiquetaUnidose(medicacaoId: string | null) {
  return useQuery<EtiquetaUnidose>({
    queryKey: chavesClinicas.etiqueta(medicacaoId ?? ''),
    queryFn: () => api.get(`/medicacao/${medicacaoId}/etiqueta`).then((r) => r.data),
    enabled: !!medicacaoId,
    gcTime: 0,
    staleTime: 0,
  });
}

export function useDefinirNaoReanimar(doenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { ativo: boolean; notas?: string }) =>
      api.patch(`/resumo/doente/${doenteId}/nao-reanimar`, dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chavesClinicas.faixa(doenteId) });
      qc.invalidateQueries({ queryKey: chavesClinicas.meuTurno });
    },
  });
}

/** Depois de administrar (ou registar uma não-administração), o turno e o MAR mudam. */
export function useInvalidarTurno() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: chavesClinicas.mar });
    qc.invalidateQueries({ queryKey: chavesClinicas.meuTurno });
    qc.invalidateQueries({ queryKey: ['resumo', 'faixa'] });
  };
}
