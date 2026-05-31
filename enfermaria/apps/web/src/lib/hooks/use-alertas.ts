import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertaClinico } from '@org/shared';
import api from '../api';

export type { AlertaClinico };

export function useAlertasPorDoente(doenteId: string | undefined) {
  return useQuery<AlertaClinico[]>({
    queryKey: ['alertas', doenteId],
    queryFn: () => api.get(`/alertas/${doenteId}`).then(r => r.data),
    enabled: !!doenteId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useAcusarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, utilizadorId }: { id: string; utilizadorId: string }) =>
      api.patch(`/alertas/${id}/acusar`, { utilizadorId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  });
}
