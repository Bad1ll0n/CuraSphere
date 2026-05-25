import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
  role: string;
  subRole?: string | null;
  servico?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export function useUtilizadores(params?: { role?: string; ativo?: boolean; servico?: string }) {
  return useQuery<Utilizador[]>({
    queryKey: ['utilizadores', params],
    queryFn: () => api.get('/utilizadores', { params }).then(r => r.data),
    staleTime: 60_000,
  });
}

export function useUtilizador(id: string | undefined) {
  return useQuery<Utilizador>({
    queryKey: ['utilizador', id],
    queryFn: () => api.get(`/utilizadores/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useAtualizarUtilizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Utilizador> }) =>
      api.patch(`/utilizadores/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['utilizadores'] });
      qc.invalidateQueries({ queryKey: ['utilizador', id] });
    },
  });
}
