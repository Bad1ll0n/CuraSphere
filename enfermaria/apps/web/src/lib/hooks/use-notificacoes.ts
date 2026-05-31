import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Notificacao, NotificacoesPaginadas } from '@org/shared';
import api from '../api';

export type { Notificacao, NotificacoesPaginadas };

export function useNotificacoes(page = 1) {
  return useQuery<NotificacoesPaginadas>({
    queryKey: ['notificacoes', page],
    queryFn: () => api.get('/notificacoes', { params: { page } }).then(r => r.data),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });
}

export function useNaoLidasCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notificacoes-count'],
    queryFn: () => api.get('/notificacoes/nao-lidas').then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarcarLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notificacoes/${id}/ler`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificacoes'] });
      qc.invalidateQueries({ queryKey: ['notificacoes-count'] });
    },
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notificacoes/marcar-todas-lidas').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificacoes'] });
      qc.invalidateQueries({ queryKey: ['notificacoes-count'] });
    },
  });
}
