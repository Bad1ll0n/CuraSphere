/**
 * PERF-10 — Sentry no cliente, carregado só quando é preciso.
 *
 * O `import * as Sentry from '@sentry/nextjs'` no arranque e nos `error.tsx` metia ~146 KB
 * gzip (SDK + Session Replay) no JavaScript inicial de TODAS as rotas, mesmo sem DSN
 * configurado. Agora:
 * - sem `NEXT_PUBLIC_SENTRY_DSN`, o SDK nunca é descarregado;
 * - com DSN, é carregado depois do primeiro ecrã (quando o browser fica livre), e os erros
 *   que acontecem antes disso ficam em fila e são enviados assim que o SDK arranca.
 * A limpeza RGPD (corpo e cookies do pedido nunca saem do browser) mantém-se.
 */
type SentryNext = typeof import('@sentry/nextjs');
type Pendente =
  | { tipo: 'erro'; erro: unknown; contexto?: Record<string, unknown> }
  | { tipo: 'mensagem'; mensagem: string; nivel: 'error' | 'warning' | 'info' };

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const MAX_PENDENTES = 20;
let sdk: SentryNext | null = null;
let aCarregar: Promise<SentryNext | null> | null = null;
const pendentes: Pendente[] = [];

function enviar(s: SentryNext, p: Pendente) {
  if (p.tipo === 'erro') s.captureException(p.erro, p.contexto ? { extra: p.contexto } : undefined);
  else s.captureMessage(p.mensagem, p.nivel);
}

/** Carrega e inicializa o SDK (uma só vez). Devolve null se não houver DSN. */
export function carregarMonitorizacao(): Promise<SentryNext | null> {
  if (!DSN || typeof window === 'undefined') return Promise.resolve(null);
  if (aCarregar) return aCarregar;
  aCarregar = import('@sentry/nextjs')
    .then((s) => {
      s.init({
        dsn: DSN,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_APP_VERSION || undefined, // OPS-08
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
      sdk = s;
      for (const p of pendentes.splice(0)) enviar(s, p);
      return s;
    })
    .catch(() => null);
  return aCarregar;
}

function registar(p: Pendente) {
  if (!DSN) return;
  if (sdk) return enviar(sdk, p);
  if (pendentes.length < MAX_PENDENTES) pendentes.push(p);
  void carregarMonitorizacao();
}

export function reportarErro(erro: unknown, contexto?: Record<string, unknown>) {
  registar({ tipo: 'erro', erro, contexto });
}

export function reportarMensagem(mensagem: string, nivel: 'error' | 'warning' | 'info' = 'error') {
  registar({ tipo: 'mensagem', mensagem, nivel });
}

/** Erros que escapam aos error boundaries, apanhados desde o primeiro instante. */
export function instalarCapturaGlobal() {
  if (typeof window === 'undefined' || !DSN) return;
  window.addEventListener('error', (e) => reportarErro(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportarErro(e.reason));
}

export const _paraTestes = { pendentes, repor: () => { sdk = null; aCarregar = null; pendentes.splice(0); } };
