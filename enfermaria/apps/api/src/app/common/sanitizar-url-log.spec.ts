import { sanitizarUrlParaLog } from './sanitizar-url-log';

describe('sanitizarUrlParaLog', () => {
  it('esconde o token do portal da família no caminho', () => {
    expect(sanitizarUrlParaLog('/v1/familia/portal/abcDEF_123-xyz')).toBe('/v1/familia/portal/[REDACTED]');
  });

  it('esconde NIF e código na query, mantendo os outros parâmetros', () => {
    expect(sanitizarUrlParaLog('/v1/quiosque/paciente?nif=123456789&x=1')).toBe(
      '/v1/quiosque/paciente?nif=[REDACTED]&x=1',
    );
    expect(sanitizarUrlParaLog('/v1/quiosque/marcacao?codigo=CON-ABCD-EF23')).toBe(
      '/v1/quiosque/marcacao?codigo=[REDACTED]',
    );
  });

  it('apanha o parâmetro em qualquer capitalização', () => {
    expect(sanitizarUrlParaLog('/x?NIF=1')).toBe('/x?NIF=[REDACTED]');
  });

  it('esconde o code do retorno OIDC', () => {
    expect(sanitizarUrlParaLog('/v1/auth/sso/oidc/callback?code=abc&state=xyz')).toBe(
      '/v1/auth/sso/oidc/callback?code=[REDACTED]&state=[REDACTED]',
    );
  });

  it('não mexe em URLs sem nada sensível', () => {
    expect(sanitizarUrlParaLog('/v1/doentes?page=2&ordem=nome')).toBe('/v1/doentes?page=2&ordem=nome');
    expect(sanitizarUrlParaLog('/v1/health')).toBe('/v1/health');
    expect(sanitizarUrlParaLog(undefined)).toBeUndefined();
  });
});
