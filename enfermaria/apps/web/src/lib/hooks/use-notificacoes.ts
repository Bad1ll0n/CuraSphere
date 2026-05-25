import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface Notificacao {
  id: string;
  titulo: string;
  corpo: string;
  tipo?: string;
  lida: boolean;
  criadaEm: string;
  dados?: Record<string, unknown>;
}

export function useNotificacoes() {
  return useQuery<Notificacao[]>({
    queryKey: ['notificacoes'],
    queryFn: () => api.get('/notificacoes').then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarcarLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notificacoes/${id}/lida`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notificacoes/todas/lidas').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });
}
