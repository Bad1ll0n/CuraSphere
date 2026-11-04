/**
 * Arranque do Sentry no **cliente**.
 *
 * Substitui `sentry.client.config.ts`, que o Next.js 16 deixou de suportar com Turbopack
 * (o build emitia um aviso de descontinuação a cada compilação). A configuração é a mesma —
 * incluindo a limpeza RGPD do corpo e cookies do pedido, que não pode desaparecer daqui.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // RGPD: não enviar corpo do request nem cookies (dados clínicos Art. 9 RGPD)
  beforeSend: (event) => {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
