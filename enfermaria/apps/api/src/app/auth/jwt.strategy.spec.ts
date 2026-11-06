import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { invalidarCacheSessao, limparCacheSessao } from './sessao-cache';

// SEC-04: a versão da sessão (`sv`) tem de coincidir com a do utilizador na BD.
describe('JwtStrategy — versão da sessão', () => {
  const prisma = { utilizador: { findUnique: jest.fn() } };
  const config = { get: jest.fn().mockReturnValue('x'.repeat(40)) };
  const strategy = new JwtStrategy(config as unknown as ConfigService, prisma as unknown as PrismaService);
  const token = { sub: 'u1', tipo: 'pessoal' as const, sv: 2, role: 'medico', servico: 'medicina' };

  beforeEach(() => {
    limparCacheSessao();
    prisma.utilizador.findUnique.mockReset();
  });

  it('aceita o token da versão actual', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 2, ativo: true });
    await expect(strategy.validate(token)).resolves.toMatchObject({ sub: 'u1', role: 'medico' });
  });

  it('recusa um token emitido antes do logout (versão antiga)', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 3, ativo: true });
    await expect(strategy.validate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa um token sem `sv` (emitido antes desta versão)', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 0, ativo: true });
    const { sv: _sv, ...semVersao } = token;
    await expect(strategy.validate(semVersao)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa o token de um utilizador desactivado ou apagado', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 2, ativo: false });
    await expect(strategy.validate(token)).rejects.toThrow(UnauthorizedException);
    limparCacheSessao();
    prisma.utilizador.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('usa a cache entre pedidos e relê a BD depois de invalidada', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 2, ativo: true });
    await strategy.validate(token);
    await strategy.validate(token);
    expect(prisma.utilizador.findUnique).toHaveBeenCalledTimes(1);

    prisma.utilizador.findUnique.mockResolvedValue({ versaoSessao: 3, ativo: true });
    invalidarCacheSessao('u1');
    await expect(strategy.validate(token)).rejects.toThrow(UnauthorizedException);
    expect(prisma.utilizador.findUnique).toHaveBeenCalledTimes(2);
  });

  it('tokens intermédios (mfa_setup) não dependem da versão da sessão', async () => {
    await expect(strategy.validate({ sub: 'u1', tipo: 'mfa_setup' })).resolves.toEqual({ sub: 'u1', tipoToken: 'mfa_setup' });
    expect(prisma.utilizador.findUnique).not.toHaveBeenCalled();
  });
});
