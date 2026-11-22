import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // OPS-08: a versão da imagem (ARG VERSAO no build).
  release: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  beforeSend: (event) => {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});
