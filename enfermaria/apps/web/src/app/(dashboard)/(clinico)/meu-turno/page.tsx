import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { MeuTurno } from '@org/shared';
import { buscarNoServidor } from '@/lib/api-servidor';
import { chavesClinicas } from '@/lib/hooks/chaves-clinicas';
import { MeuTurnoCliente } from './meu-turno-cliente';

/**
 * PERF-12 — "O meu turno" chega com os dados no primeiro HTML: o servidor pede-os à api com a
 * sessão do utilizador e o react-query do browser começa já com eles (sem esperar pela
 * hidratação + um segundo pedido). Se o pedido no servidor falhar, o browser pede como antes.
 */
export default async function MeuTurnoPage() {
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: chavesClinicas.meuTurno, queryFn: () => buscarNoServidor<MeuTurno>('/resumo/meu-turno') });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MeuTurnoCliente />
    </HydrationBoundary>
  );
}
