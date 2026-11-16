import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { LinhaMar } from '@org/shared';
import { buscarNoServidor } from '@/lib/api-servidor';
import { chavesClinicas } from '@/lib/hooks/chaves-clinicas';
import { MarCliente } from './mar-cliente';

/**
 * PERF-12 — o MAR chega com as medicações no primeiro HTML (ver meu-turno/page.tsx). Se o
 * pedido no servidor falhar, o browser pede como antes — e uma falha continua a aparecer como
 * falha, nunca como "sem medicações".
 */
export default async function MarPage() {
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: chavesClinicas.mar, queryFn: () => buscarNoServidor<LinhaMar[]>('/medicacao/mar') });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MarCliente />
    </HydrationBoundary>
  );
}
