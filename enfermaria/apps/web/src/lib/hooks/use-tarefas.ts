import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tarefa } from '@org/shared';
import api from '../api';

export type { Tarefa };

export function useTarefasPorDoente(doenteId: string | undefined) {
  return useQuery<Tarefa[]>({
    queryKey: ['tarefas', 'doente', doenteId],
    queryFn: () => api.get(`/tarefas`, { params: { doenteId } }).then(r => r.data),
    enabled: !!doenteId,
    staleTime: 20_000,
  });
}

export function useTarefasPendentes() {
  return useQuery<Tarefa[]>({
    queryKey: ['tarefas', 'pendentes'],
    queryFn: () => api.get('/tarefas', { params: { estado: 'pendente' } }).then(r => r.data),
    staleTime: 20_000,
  });
}

export function useCriarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/tarefas', data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tarefas'] });
      if (vars.doenteId) qc.invalidateQueries({ queryKey: ['doente', vars.doenteId] });
    },
  });
}

export function useAtualizarEstadoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.patch(`/tarefas/${id}/estado`, { estado }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  });
}
