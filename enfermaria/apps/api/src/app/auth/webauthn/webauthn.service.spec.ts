import { BadRequestException, UnauthorizedException } from '@nestjs/common';

const verifyAuthenticationResponse = jest.fn();
const verifyRegistrationResponse = jest.fn();
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(async () => ({ challenge: 'desafio-registo' })),
  generateAuthenticationOptions: jest.fn(async () => ({ challenge: 'desafio-auth' })),
  verifyAuthenticationResponse: (...a: unknown[]) => verifyAuthenticationResponse(...a),
  verifyRegistrationResponse: (...a: unknown[]) => verifyRegistrationResponse(...a),
}));

import { WebAuthnService } from './webauthn.service';

// QA-21 — passkeys (0 % de cobertura): os ramos de recusa são os que importam.
describe('WebAuthnService', () => {
  const cred = { credentialId: 'cred-1', utilizadorId: 'u1', publicKey: Buffer.from([1, 2]), counter: 5n, transports: [], utilizador: { id: 'u1', ativo: true } };
  let prisma: any, redis: any, svc: WebAuthnService;
  beforeEach(() => {
    verifyAuthenticationResponse.mockReset();
    verifyRegistrationResponse.mockReset();
    prisma = {
      utilizador: { findUnique: jest.fn() },
      webAuthnCredential: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    svc = new WebAuthnService(prisma, redis, { get: (_k: string, d: string) => d } as any);
  });

  describe('autenticação', () => {
    it('passkey desconhecida → 401', async () => {
      prisma.webAuthnCredential.findUnique.mockResolvedValue(null);
      await expect(svc.verifyAuthentication({ id: 'x' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('sem desafio emitido (ou expirado) → 401, sem chegar à verificação criptográfica', async () => {
      prisma.webAuthnCredential.findUnique.mockResolvedValue(cred);
      redis.get.mockResolvedValue(null);
      await expect(svc.verifyAuthentication({ id: 'cred-1' } as any)).rejects.toThrow(/Challenge expirado/);
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    it('assinatura inválida ou verificação a lançar → 401', async () => {
      prisma.webAuthnCredential.findUnique.mockResolvedValue(cred);
      redis.get.mockResolvedValue('desafio');
      verifyAuthenticationResponse.mockResolvedValueOnce({ verified: false });
      await expect(svc.verifyAuthentication({ id: 'cred-1' } as any)).rejects.toThrow(/Passkey inválida/);
      verifyAuthenticationResponse.mockRejectedValueOnce(new Error('origem errada'));
      await expect(svc.verifyAuthentication({ id: 'cred-1' } as any)).rejects.toThrow(/falhou/);
      expect(prisma.webAuthnCredential.update).not.toHaveBeenCalled();
    });

    it('sucesso: verifica contra o desafio, a origem e o contador; actualiza o contador e consome o desafio', async () => {
      prisma.webAuthnCredential.findUnique.mockResolvedValue(cred);
      redis.get.mockResolvedValue('desafio');
      verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 6 } });
      const u = await svc.verifyAuthentication({ id: 'cred-1' } as any);
      expect(u).toBe(cred.utilizador);
      const args = verifyAuthenticationResponse.mock.calls[0][0];
      expect(args).toMatchObject({ expectedChallenge: 'desafio', expectedOrigin: 'http://localhost:4200', expectedRPID: 'localhost' });
      expect(args.credential.counter).toBe(5);
      expect(prisma.webAuthnCredential.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ counter: 6n }) }));
      expect(redis.del).toHaveBeenCalledWith('webauthn:auth:challenge:u1'); // anti-replay do desafio
    });
  });

  describe('registo', () => {
    it('sem desafio de registo → 400; verificação falhada → 400; nada é gravado', async () => {
      redis.get.mockResolvedValueOnce(null);
      await expect(svc.verifyRegistration('u1', {} as any, 'Portátil')).rejects.toBeInstanceOf(BadRequestException);
      redis.get.mockResolvedValue('desafio-registo');
      verifyRegistrationResponse.mockRejectedValueOnce(new Error('x'));
      await expect(svc.verifyRegistration('u1', {} as any, 'Portátil')).rejects.toBeInstanceOf(BadRequestException);
      verifyRegistrationResponse.mockResolvedValueOnce({ verified: false });
      await expect(svc.verifyRegistration('u1', {} as any, 'Portátil')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.webAuthnCredential.create).not.toHaveBeenCalled();
    });
  });

  it('remover: só as passkeys do próprio utilizador', async () => {
    prisma.webAuthnCredential.findFirst.mockResolvedValue(null);
    await expect(svc.removerCredencial('cred-de-outro', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.webAuthnCredential.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cred-de-outro', utilizadorId: 'u1' }) }));
    expect(prisma.webAuthnCredential.delete).not.toHaveBeenCalled();
  });

  it('desafio para um utilizador sem passkeys → 400', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ id: 'u1', webAuthnCredentials: [] });
    await expect(svc.generateAuthChallengeForUser('00001')).rejects.toBeInstanceOf(BadRequestException);
  });
});
