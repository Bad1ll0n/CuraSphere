/**
 * PERF-12 — o que a lista de doentes partilha entre o Server Component (que a pré-carrega no
 * primeiro HTML) e o componente do browser. Sem 'use client': os valores têm de chegar ao
 * servidor como valores, não como referências de cliente.
 */
export const ROLES_CLINICOS = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];
export const LIMIT = 25;

export const chaveListaDoentes = (pagina: number, todos: boolean, pesquisa: string) => ['doentes', pagina, todos, pesquisa] as const;

/** O pedido da 1.ª página, tal como o browser o faria. */
export function caminhoListaDoentes(pagina: number, todos: boolean, pesquisa = ''): string {
  const params = new URLSearchParams({ page: String(pagina), limit: String(LIMIT) });
  if (todos) params.set('todos', 'true');
  if (pesquisa) params.set('search', pesquisa);
  return `/doentes?${params}`;
}
