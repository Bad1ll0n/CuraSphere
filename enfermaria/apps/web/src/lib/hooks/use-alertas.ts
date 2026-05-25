import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface AlertaClinico {
  id: string;
  doenteId: string;
  tipo: string;
  mensagem: string;
  urgencia: boolean;
  lido: boolean;
  criadoEm: string;
  acusadoEm?: string | null;
  acusadoPor?: { id: string; nome: string } | null;
}

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
