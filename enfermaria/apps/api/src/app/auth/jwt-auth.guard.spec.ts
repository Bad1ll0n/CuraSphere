import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TIPOS_TOKEN_KEY } from './tipos-token.decorator';

// QA-21 — o guard de TODA a API (8 % de ramos cobertos). SEC-03: cada endpoint aceita só os
// tipos de token que declara; por omissão, só uma sessão de funcionário completa.
describe('JwtAuthGuard', () => {
  const passport = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: (...a: unknown[]) => unknown };
  let espiao: jest.SpyInstance;
  afterEach(() => espiao?.mockRestore());

  const correr = async (user: unknown, opts: { passa?: boolean; tipos?: string[] } = {}) => {
    espiao = jest.spyOn(passport as any, 'canActivate').mockResolvedValue(opts.passa ?? true);
    const handler = () => undefined;
    if (opts.tipos) Reflect.defineMetadata(TIPOS_TOKEN_KEY, opts.tipos, handler);
    const ctx: any = {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };
    return new JwtAuthGuard(new Reflector()).canActivate(ctx);
  };

  it('assinatura/expiração inválidas (passport falha): recusa', async () => {
    await expect(correr({ tipoToken: 'pessoal' }, { passa: false })).resolves.toBe(false);
  });

  it('por omissão só aceita a sessão de funcionário completa', async () => {
    await expect(correr({ tipoToken: 'pessoal' })).resolves.toBe(true);
    for (const tipo of ['mfa_desafio', 'password_expirada', 'portal', undefined]) {
      await expect(correr({ tipoToken: tipo })).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(correr(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('@TiposToken abre o endpoint só aos tipos declarados (ex.: configurar MFA)', async () => {
    await expect(correr({ tipoToken: 'mfa_configuracao' }, { tipos: ['mfa_configuracao'] })).resolves.toBe(true);
    await expect(correr({ tipoToken: 'pessoal' }, { tipos: ['mfa_configuracao'] })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
