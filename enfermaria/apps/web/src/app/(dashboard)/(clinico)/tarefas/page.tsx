import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { buscarNoServidor } from '@/lib/api-servidor';
import { TarefasCliente } from './tarefas-cliente';
import { CHAVE_MINHAS_TAREFAS } from './chave';

/**
 * PERF-12 — as tarefas do turno chegam no primeiro HTML. Se o pedido no servidor falhar, o
 * browser pede como antes.
 */
export default async function TarefasPage() {
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: CHAVE_MINHAS_TAREFAS, queryFn: () => buscarNoServidor('/tarefas/minhas') });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <TarefasCliente />
    </HydrationBoundary>
  );
}
