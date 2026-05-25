import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface DoenteListItem {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  estadoRegisto: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  cama?: { id: string; numero: string; quarto: string } | null;
}

export interface DoentesPaginados {
  data: DoenteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
}

export function useDoentes(page = 1, limit = 25) {
  return useQuery<DoentesPaginados>({
    queryKey: ['doentes', page, limit],
    queryFn: () => api.get('/doentes', { params: { page, limit } }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDoente(id: string | undefined) {
  return useQuery({
    queryKey: ['doente', id],
    queryFn: () => api.get(`/doentes/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useAdmitirDoente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/doentes', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doentes'] }),
  });
}

export function useDarAlta(doenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminId: string) => api.post(`/doentes/${doenteId}/alta`, { administrativoId: adminId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doentes'] });
      qc.invalidateQueries({ queryKey: ['doente', doenteId] });
    },
  });
}
