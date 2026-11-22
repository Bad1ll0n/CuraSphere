/**
 * OPS-08 — a versão em execução (tag do release, ou o SHA), injetada no build da imagem
 * (`ARG VERSAO` → `APP_VERSION`). Vai para o `release` do Sentry, para o `service.version` do
 * tracing e para o /v1/health: sem ela, um erro no Sentry não dizia de que versão vinha.
 */
export function versaoDaAplicacao(): string {
  return process.env['APP_VERSION'] || process.env['SENTRY_RELEASE'] || 'desenvolvimento';
}
