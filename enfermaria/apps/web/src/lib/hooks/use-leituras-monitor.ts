import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeituraMonitorPendente, ResultadoValidacaoLeituras } from '@org/shared';
import api from '../api';
import { chavesClinicas } from './chaves-clinicas';

/**
 * PROD-15 — leituras dos monitores à espera de validação de enfermagem. Validar ou rejeitar
 * invalida as pendentes do doente e o resumo do turno.
 */
export function useLeiturasMonitor(doenteId: string) {
  return useQuery<LeituraMonitorPendente[]>({
    queryKey: chavesClinicas.leiturasMonitor(doenteId),
    queryFn: () => api.get(`/monitorizacao/doente/${doenteId}/leituras-pendentes`).then((r) => r.data),
    enabled: !!doenteId,
    refetchInterval: 60_000,
  });
}

export function useDecidirLeituras(doenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { acao: 'validar' } & { ids: string[] } | { acao: 'rejeitar'; ids: string[]; motivo: string }) => {
      const { acao, ...corpo } = p;
      return api.post<ResultadoValidacaoLeituras & { rejeitadas?: number }>(`/monitorizacao/doente/${doenteId}/leituras/${acao}`, corpo).then((r) => r.data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chavesClinicas.leiturasMonitor(doenteId) });
      qc.invalidateQueries({ queryKey: chavesClinicas.meuTurno });
    },
  });
}
