/**
 * Content-Security-Policy da aplicação web.
 *
 * A CSP vivia no `headers()` do next.config.js e nunca chegou a ser enviada: o `withNx` devolve
 * uma função assíncrona e o `withNextIntl` tratava-a como objecto, pelo que a configuração saía
 * sem `headers`, sem `output` e sem `transpilePackages`. E, se tivesse sido enviada, partia a
 * aplicação toda — `script-src 'self'` bloqueia os scripts inline com que o App Router hidrata.
 *
 * Por isso é gerada por pedido no middleware, com um nonce: o Next lê-o do cabeçalho do pedido e
 * aplica-o aos scripts que emite, e o `strict-dynamic` deixa passar o que esses scripts carregam
 * (o `external_api.js` do Jitsi, por exemplo) sem abrir a porta a scripts injectados.
 */
export interface OpcoesCsp {
  nonce: string;
  /** NEXT_PUBLIC_API_URL — pode trazer caminho (`https://h/api`); o relatório usa-o por inteiro. */
  apiUrl?: string;
  /** NEXT_PUBLIC_JITSI_SERVER — a teleconsulta embebe-o num iframe. */
  jitsiServer?: string;
  /**
   * CSP_STORAGE_ORIGIN — origem do MinIO/S3. Os documentos e as fotografias clínicas chegam como
   * URLs assinados desse servidor e abrem-se em `<img>` e `<iframe>`.
   */
  storageOrigin?: string;
  /** NEXT_PUBLIC_SENTRY_DSN — o SDK envia os eventos para o host do DSN. */
  sentryDsn?: string;
  /** Em desenvolvimento o React Refresh precisa de `eval`. */
  dev?: boolean;
}

export const JITSI_POR_OMISSAO = 'https://meet.jit.si';

export function origemDe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function construirCsp(o: OpcoesCsp): string {
  const apiUrl = (o.apiUrl || 'http://localhost:3333').replace(/\/+$/, '');
  const api = origemDe(apiUrl);
  const apiWs = api?.replace(/^http/, 'ws') ?? null;
  const jitsi = origemDe(o.jitsiServer) ?? JITSI_POR_OMISSAO;
  const storage = origemDe(o.storageOrigin);
  const sentry = origemDe(o.sentryDsn);

  const directivas: Record<string, (string | null | false | undefined)[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${o.nonce}'`, "'strict-dynamic'", o.dev && "'unsafe-eval'"],
    // Os estilos inline são usados em todo o lado (style={{...}}) e não executam código.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', storage],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", api, apiWs, storage, sentry],
    'media-src': ["'self'", 'blob:', storage],
    'frame-src': ["'self'", 'blob:', storage, jitsi],
    'worker-src': ["'self'", 'blob:'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'report-uri': [`${apiUrl}/v1/csp-report`],
  };

  return Object.entries(directivas)
    .map(([nome, valores]) => [nome, ...new Set(valores.filter(Boolean))].join(' '))
    .join('; ');
}

/**
 * Permissions-Policy. `camera=()` desligava a câmara também dentro de iframes — a teleconsulta
 * abria o Jitsi sem imagem nem som. A delegação tem de nomear a origem do Jitsi.
 */
export function construirPermissionsPolicy(jitsiServer?: string): string {
  const jitsi = origemDe(jitsiServer) ?? JITSI_POR_OMISSAO;
  const selfEJitsi = `(self "${jitsi}")`;
  return [
    `camera=${selfEJitsi}`,
    `microphone=${selfEJitsi}`,
    `display-capture=${selfEJitsi}`,
    'geolocation=(self)',
    'payment=()',
  ].join(', ');
}
