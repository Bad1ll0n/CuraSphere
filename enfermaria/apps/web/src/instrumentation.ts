/**
 * Ponto de arranque do Sentry no **servidor**.
 *
 * Os ficheiros `sentry.server.config.ts` e `sentry.edge.config.ts` já existiam, mas o
 * `@sentry/nextjs` nunca os carregava: sem este `instrumentation.ts` o SDK não é inicializado
 * do lado do servidor, e o próprio build avisava disso a cada compilação
 * («Could not find a Next.js instrumentation file»). Na prática, todos os erros de render no
 * servidor e nos Route Handlers eram perdidos — só o cliente reportava.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
