import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { buscarNoServidor, papelDaSessao } from '@/lib/api-servidor';
import { DoentesCliente } from './doentes-cliente';
import { ROLES_CLINICOS, caminhoListaDoentes, chaveListaDoentes } from './lista';

/**
 * PERF-12 — a lista de doentes chega com a 1.ª página no primeiro HTML (como o MAR e O meu
 * turno). Os clínicos começam em "os meus"; os outros papéis veem todos. Se o pedido no servidor
 * falhar, o browser pede como antes.
 */
export default async function DoentesPagina() {
  const qc = new QueryClient();
  const papel = await papelDaSessao();
  if (papel) {
    const todos = !ROLES_CLINICOS.includes(papel);
    await qc.prefetchQuery({ queryKey: chaveListaDoentes(1, todos, ''), queryFn: () => buscarNoServidor(caminhoListaDoentes(1, todos)) });
  }
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DoentesCliente />
    </HydrationBoundary>
  );
}
