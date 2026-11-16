/**
 * Arranque da monitorização no **cliente**.
 *
 * PERF-10: o SDK do Sentry já não é importado aqui de forma estática (eram ~146 KB gzip em
 * todas as rotas). As falhas globais são apanhadas desde já e o SDK é carregado quando o
 * browser fica livre, e só se houver DSN — ver src/lib/monitorizacao.ts, que mantém a
 * limpeza RGPD do corpo e dos cookies do pedido.
 */
import { carregarMonitorizacao, instalarCapturaGlobal } from './lib/monitorizacao';

instalarCapturaGlobal();
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const quandoLivre = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (quandoLivre) quandoLivre(() => void carregarMonitorizacao(), { timeout: 5000 });
  else setTimeout(() => void carregarMonitorizacao(), 2000);
}
