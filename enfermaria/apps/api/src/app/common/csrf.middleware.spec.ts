import { ForbiddenException } from '@nestjs/common';
import { CsrfMiddleware } from './csrf.middleware';

function pedido(parcial: { method?: string; url?: string; cookies?: Record<string, string>; headers?: Record<string, string> }) {
  const url = parcial.url ?? '/v1/doentes';
  return { method: parcial.method ?? 'POST', url, originalUrl: url, cookies: parcial.cookies ?? {}, headers: parcial.headers ?? {} };
}

describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();
  const correr = (req: ReturnType<typeof pedido>) => {
    const next = jest.fn();
    middleware.use(req, {}, next);
    return next;
  };

  beforeEach(() => { delete process.env['ALLOWED_ORIGINS']; });

  it('recusa um POST com sessão por cookie e sem token nem origem permitida', () => {
    expect(() => correr(pedido({ cookies: { access_token: 't' } }))).toThrow(ForbiddenException);
  });

  it('aceita o double-submit quando o cabeçalho coincide com o cookie', () => {
    const next = correr(pedido({ cookies: { access_token: 't', 'csrf-token': 'abc' }, headers: { 'x-csrf-token': 'abc' } }));
    expect(next).toHaveBeenCalled();
  });

  it('recusa o double-submit com cabeçalho diferente', () => {
    expect(() =>
      correr(pedido({ cookies: { access_token: 't', 'csrf-token': 'abc' }, headers: { 'x-csrf-token': 'xyz' } })),
    ).toThrow(ForbiddenException);
  });

  it('deixa passar o relatório de CSP que o browser envia com os cookies de sessão', () => {
    const next = correr(pedido({ url: '/api/v1/csp-report', cookies: { access_token: 't' } }));
    expect(next).toHaveBeenCalled();
  });

  it('a excepção é só para esse caminho — não para rotas que apenas o contenham', () => {
    expect(() =>
      correr(pedido({ url: '/v1/csp-report/../doentes', cookies: { access_token: 't' } })),
    ).toThrow(ForbiddenException);
    expect(() =>
      correr(pedido({ url: '/v1/doentes?volta=/csp-report', cookies: { access_token: 't' } })),
    ).toThrow(ForbiddenException);
  });
});
