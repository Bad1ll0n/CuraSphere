import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { buscarNoServidor } from '@/lib/api-servidor';
import { PassagemCliente } from './passagem-cliente';
import { caminhoPassagem, chavePassagem } from './chave';

/**
 * PERF-12 — a passagem de turno chega com a lista do serviço por omissão no primeiro HTML. Se o
 * pedido no servidor falhar, o browser pede como antes (e uma falha aparece como falha).
 */
export default async function PassagemTurnoPage() {
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: chavePassagem(''), queryFn: () => buscarNoServidor(caminhoPassagem('')) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <PassagemCliente />
    </HydrationBoundary>
  );
}
