import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnomalyDetectionService } from '../common/anomaly-detection.service';

jest.mock('otplib', () => ({
  verify: jest.fn().mockResolvedValue({ valid: true, delta: 0 }),
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/CuraSphere:00001?secret=JBSWY3DPEHPK3PXP'),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAuthenticator = require('otplib') as {
  verify: jest.Mock;
  generateSecret: jest.Mock;
  generateURI: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockQrcode = require('qrcode') as { toDataURL: jest.Mock };

const mockPrisma = {
  tryBecomeLeader: jest.fn().mockResolvedValue(true), // líder por omissão → o corpo do cron corre
  utilizador: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  // Anti-replay de TOTP: durável em Postgres. Decisão por LEITURA: $queryRaw devolve as linhas
  // AINDA ATIVAS desta chave (vazio = primeira vez → permite; não-vazio = replay). $executeRaw
  // grava (upsert) e serve o DELETE de expirados (cron).
  $queryRaw: jest.fn().mockResolvedValue([]),
  $executeRaw: jest.fn().mockResolvedValue(0),
  // QA-19: desafios MFA de uso único.
  desafioMfa: {
    create: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('jwt-access-token'),
  verify: jest.fn(),
  decode: jest.fn().mockReturnValue({ jti: 'test-jti' }),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('7d'),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  setIfNotExists: jest.fn().mockResolvedValue(true),
};

const mockAnomaly = {
  verificarIpLogin: jest.fn(),
  rastrearAcessoDoente: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  let hashCorreto: string;

  beforeAll(async () => {
    hashCorreto = await bcrypt.hash('passwordCorreta', 10);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    mockJwt.sign.mockReturnValue('jwt-access-token');
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token-xyz' });
    mockPrisma.tryBecomeLeader.mockResolvedValue(true);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$executeRaw.mockResolvedValue(0);
    mockPrisma.desafioMfa.create.mockResolvedValue({});
    mockPrisma.desafioMfa.aggregate.mockResolvedValue({ _sum: { tentativas: 0 } });
    mockPrisma.desafioMfa.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.setIfNotExists.mockResolvedValue(true);
    mockAuthenticator.verify.mockResolvedValue({ valid: true, delta: 0 });
    mockAuthenticator.generateSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
    mockAuthenticator.generateURI.mockReturnValue('otpauth://totp/CuraSphere:00001?secret=JBSWY3DPEHPK3PXP');
    mockQrcode.toDataURL.mockResolvedValue('data:image/png;base64,fake');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: AnomalyDetectionService, useValue: mockAnomaly },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login() ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('lança UnauthorizedException para utilizador inexistente', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.login('99999', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para utilizador inativo', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: false, passwordHash: hashCorreto,
      });

      await expect(service.login('12345', 'passwordCorreta')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando a password está incorreta', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345', servico: 'medicina',
      });

      await expect(service.login('12345', 'passwordErrada')).rejects.toThrow(UnauthorizedException);
    });

    it('retorna mfaPendente=true quando MFA está ativo', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, passwordHash: hashCorreto,
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345', servico: 'medicina',
      });

      const resultado = await service.login('12345', 'passwordCorreta');

      expect(resultado.mfaPendente).toBe(true);
      expect(resultado).toHaveProperty('mfaChallengeToken');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ mfaChallenge: true }),
        expect.objectContaining({ expiresIn: '5m', jwtid: expect.any(String) }),
      );
      // QA-19: o jti do desafio fica gravado para ser de uso único.
      const jwtid = mockJwt.sign.mock.calls[0][1].jwtid;
      expect(mockPrisma.desafioMfa.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ jti: jwtid, utilizadorId: '1' }),
      });
    });

    it('devolve accessToken e refreshToken em login bem sucedido sem MFA', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'ti', nome: 'Admin TI', numeroFuncionario: '12345',
        servico: 'ti', passwordExpiresAt: null,
      });

      const resultado = await service.login('12345', 'passwordCorreta');

      expect(resultado.mfaPendente).toBe(false);
      expect(resultado).toHaveProperty('accessToken', 'jwt-access-token');
      expect(typeof resultado.refreshToken).toBe('string');
      expect(resultado.refreshToken!.length).toBeGreaterThan(0);
    });

    it('sinaliza passwordExpiradoAviso quando expira em ≤10 dias', async () => {
      const em5Dias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'ti', nome: 'Admin TI', numeroFuncionario: '12345',
        servico: 'ti', passwordExpiresAt: em5Dias,
      });

      const resultado = await service.login('12345', 'passwordCorreta') as any;

      expect(resultado.passwordExpiradoAviso).toBe(true);
      expect(resultado.diasRestantesSenha).toBeLessThanOrEqual(10);
    });

    it('lança UnauthorizedException quando conta está bloqueada', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'ti', nome: 'Admin TI', numeroFuncionario: '12345', servico: 'ti',
      });
      // lockKey tem valor → conta bloqueada
      mockRedis.get.mockResolvedValue('1');

      await expect(service.login('12345', 'passwordCorreta')).rejects.toThrow(
        /bloqueada/i,
      );
    });

    it('bloqueia conta após 5 falhas consecutivas', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'ti', nome: 'Admin TI', numeroFuncionario: '12345', servico: 'ti',
      });
      // lockKey → null (não bloqueada); failKey → 4 (4 falhas anteriores, esta é a 5ª)
      mockRedis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(4);

      await expect(service.login('12345', 'passwordErrada')).rejects.toThrow(UnauthorizedException);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('login:lock:1'),
        '1',
        900,
      );
    });

    it('retorna mfaSetupObrigatorio para role clínico sem MFA configurado', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, mfaSecret: null, passwordHash: hashCorreto,
        role: 'medico', nome: 'Dr. Clínico', numeroFuncionario: '12345',
        servico: 'medicina', passwordExpiresAt: null,
      });

      const resultado = await service.login('12345', 'passwordCorreta') as any;

      expect(resultado.mfaSetupObrigatorio).toBe(true);
      expect(resultado).toHaveProperty('mfaSetupToken');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ mfaSetup: true }),
        expect.objectContaining({ expiresIn: '30m' }),
      );
    });

    it('retorna passwordExpirada quando a password já expirou', async () => {
      const noPassado = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'ti', nome: 'Admin TI', numeroFuncionario: '12345',
        servico: 'ti', passwordExpiresAt: noPassado,
      });

      const resultado = await service.login('12345', 'passwordCorreta') as any;

      expect(resultado.passwordExpirada).toBe(true);
      expect(resultado).toHaveProperty('passwordExpiredToken');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ passwordExpired: true }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });
  });

  // ── verificarMfaLogin() ────────────────────────────────────────────────────

  describe('verificarMfaLogin()', () => {
    it('lança UnauthorizedException quando jwt.verify lança', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('expired'); });

      await expect(service.verificarMfaLogin('token-invalido', '123456')).rejects.toThrow(
        /Desafio MFA expirado/i,
      );
    });

    it('lança UnauthorizedException quando token não tem mfaChallenge', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: false });

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(
        /Token inválido/i,
      );
    });

    // SEC-03 (regressão): antes da separação de domínios, os 4 tipos de token partilhavam
    // segredo, issuer e audience. Um access token de pessoal apresentado aqui era aceite.
    it('rejeita um token que não seja do tipo mfa_challenge', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'pessoal', role: 'medico' });

      await expect(service.verificarMfaLogin('access-token-de-pessoal', '123456')).rejects.toThrow(
        /Token inválido/i,
      );
    });

    it('verifica o desafio contra a audiência dedicada, não só a assinatura', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });

      await service.verificarMfaLogin('token', '123456');

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ audience: 'curasphere-mfa-challenge', issuer: 'curasphere-api' }),
      );
    });

    it('lança UnauthorizedException quando utilizador não existe', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando mfaAtivo=false', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: false, mfaSecret: null,
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para código TOTP inválido', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });
      mockAuthenticator.verify.mockResolvedValue({ valid: false, delta: 0 });

      await expect(service.verificarMfaLogin('token', '000000')).rejects.toThrow(
        /Código MFA inválido/i,
      );
    });

    it('lança UnauthorizedException quando código TOTP é replay', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });
      // código válido mas já usado → existe uma linha ainda ativa para esta chave (replay)
      mockPrisma.$queryRaw.mockResolvedValue([{ existe: 1 }]);

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(
        /já utilizado/i,
      );
    });

    it('devolve accessToken e refreshToken em verificação bem sucedida', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345', servico: 'medicina',
      });

      const resultado = await service.verificarMfaLogin('token', '123456');

      expect(resultado).toHaveProperty('accessToken', 'jwt-access-token');
      expect(typeof (resultado as { refreshToken: string }).refreshToken).toBe('string');
    });
  });

  describe('verificarMfaLogin() — desafio de uso único (QA-19)', () => {
    const utilizadorMfa = {
      id: '1', ativo: true, mfaAtivo: true, mfaSecret: 'SECRET', passwordExpiresAt: null, versaoSessao: 3,
      role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
    };
    beforeEach(() => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true, jti: 'j1' });
      mockPrisma.utilizador.findUnique.mockResolvedValue(utilizadorMfa);
    });

    it('recusa um desafio sem jti (emitido antes desta versão)', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', tipo: 'mfa_challenge', mfaChallenge: true });
      await expect(service.verificarMfaLogin('t', '123456')).rejects.toThrow(/Token inválido/);
    });

    it('recusa reutilizar um desafio já consumido, esgotado ou expirado', async () => {
      mockPrisma.desafioMfa.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.verificarMfaLogin('t', '123456')).rejects.toThrow(/expirado ou já utilizado/);
      expect(mockAuthenticator.verify).not.toHaveBeenCalled();
      expect(mockPrisma.desafioMfa.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ jti: 'j1', utilizadorId: '1', consumidoEm: null, tentativas: { lt: 5 } }),
        data: { tentativas: { increment: 1 } },
      }));
    });

    it('bloqueia a conta após 10 códigos errados na janela', async () => {
      mockPrisma.desafioMfa.aggregate.mockResolvedValue({ _sum: { tentativas: 10 } });
      await expect(service.verificarMfaLogin('t', '123456')).rejects.toThrow(/Demasiados códigos/);
      expect(mockPrisma.desafioMfa.updateMany).not.toHaveBeenCalled();
    });

    it('marca o desafio consumido e leva a versão da sessão no token', async () => {
      await service.verificarMfaLogin('t', '123456');
      expect(mockPrisma.desafioMfa.updateMany).toHaveBeenLastCalledWith({
        where: { jti: 'j1', consumidoEm: null },
        data: { consumidoEm: expect.any(Date) },
      });
      expect(mockJwt.sign).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'pessoal', sv: 3 }));
    });

    it('perde a corrida se outro pedido consumir o desafio primeiro', async () => {
      mockPrisma.desafioMfa.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      await expect(service.verificarMfaLogin('t', '123456')).rejects.toThrow(/já utilizado/);
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('com a password expirada devolve o token de alteração e não abre sessão', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ ...utilizadorMfa, passwordExpiresAt: new Date(Date.now() - 1000) });
      const r = await service.verificarMfaLogin('t', '123456');
      expect(r).toMatchObject({ passwordExpirada: true, passwordExpiredToken: 'jwt-access-token' });
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('recusa um utilizador desactivado entretanto', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ ...utilizadorMfa, ativo: false });
      await expect(service.verificarMfaLogin('t', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── limparTotpExpirados() (housekeeping) ─────────────────────────────────────

  describe('limparTotpExpirados()', () => {
    it('apaga os TOTP expirados via $executeRaw', async () => {
      await service.limparTotpExpirados();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('não propaga erro se a limpeza falhar', async () => {
      mockPrisma.$executeRaw.mockRejectedValueOnce(new Error('BD offline'));
      await expect(service.limparTotpExpirados()).resolves.toBeUndefined();
    });
  });

  // ── setupMfa() ───────────────────────────────────────────────────────────────

  describe('setupMfa()', () => {
    it('lança UnauthorizedException quando utilizador não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.setupMfa('user-id-1')).rejects.toThrow(UnauthorizedException);
    });

    it('lança BadRequestException quando MFA já está ativo', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        numeroFuncionario: '12345', mfaAtivo: true,
      });

      await expect(service.setupMfa('user-id-1')).rejects.toThrow(BadRequestException);
    });

    it('devolve secret e qrCodeDataUrl quando MFA ainda não está ativo', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        numeroFuncionario: '12345', mfaAtivo: false,
      });

      const resultado = await service.setupMfa('user-id-1');

      expect(resultado).toHaveProperty('secret', 'JBSWY3DPEHPK3PXP');
      expect(resultado).toHaveProperty('qrCodeDataUrl', 'data:image/png;base64,fake');
      // SEC-02: o segredo proposto fica guardado no servidor.
      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' }, data: { mfaSecretPendente: 'JBSWY3DPEHPK3PXP' },
      });
    });
  });

  // ── ativarMfa() ───────────────────────────────────────────────────────────────

  describe('ativarMfa()', () => {
    beforeEach(() => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ mfaAtivo: false, mfaSecretPendente: 'MY-SECRET' });
    });

    it('SEC-02: recusa com 409 quando o MFA já está ativo (não troca o 2.º factor)', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ mfaAtivo: true, mfaSecretPendente: null });
      await expect(service.ativarMfa('user-id-1', '123456')).rejects.toThrow(ConflictException);
      expect(mockPrisma.utilizador.update).not.toHaveBeenCalled();
    });

    it('SEC-02: recusa sem setup prévio (sem segredo pendente no servidor)', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ mfaAtivo: false, mfaSecretPendente: null });
      await expect(service.ativarMfa('user-id-1', '123456')).rejects.toThrow(/Inicie primeiro/);
    });

    it('lança BadRequestException para código TOTP inválido', async () => {
      mockAuthenticator.verify.mockResolvedValue({ valid: false, delta: 0 });

      await expect(service.ativarMfa('user-id-1', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException quando código é replay', async () => {
      mockAuthenticator.verify.mockResolvedValue({ valid: true, delta: 0 });
      mockPrisma.$queryRaw.mockResolvedValue([{ existe: 1 }]);

      await expect(service.ativarMfa('user-id-1', '123456')).rejects.toThrow(
        /Código já utilizado/i,
      );
    });

    it('actualiza utilizador com mfaSecret e mfaAtivo=true', async () => {
      mockAuthenticator.verify.mockResolvedValue({ valid: true, delta: 0 });
      mockRedis.setIfNotExists.mockResolvedValue(true);
      mockPrisma.utilizador.update.mockResolvedValue({});

      const resultado = await service.ativarMfa('user-id-1', '123456');

      expect(mockAuthenticator.verify).toHaveBeenCalledWith({ token: '123456', secret: 'MY-SECRET' });
      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-1' },
          data: { mfaSecret: 'MY-SECRET', mfaAtivo: true, mfaSecretPendente: null },
        }),
      );
      expect(resultado).toMatchObject({ mensagem: expect.stringContaining('ativada') });
    });
  });

  // ── desativarMfa() ────────────────────────────────────────────────────────────

  describe('desativarMfa()', () => {
    it('lança BadRequestException quando MFA não está ativo', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: false, mfaSecret: null,
      });

      await expect(service.desativarMfa('user-id-1', '123456')).rejects.toThrow(
        /MFA não está ativo/i,
      );
    });

    it('lança BadRequestException para código TOTP inválido', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
      });
      mockAuthenticator.verify.mockResolvedValue({ valid: false, delta: 0 });

      await expect(service.desativarMfa('user-id-1', '000000')).rejects.toThrow(BadRequestException);
    });

    it('limpa mfaSecret e define mfaAtivo=false', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
      });
      mockAuthenticator.verify.mockResolvedValue({ valid: true, delta: 0 });
      mockRedis.setIfNotExists.mockResolvedValue(true);
      mockPrisma.utilizador.update.mockResolvedValue({});

      await service.desativarMfa('user-id-1', '123456');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-1' },
          data: { mfaSecret: null, mfaAtivo: false },
        }),
      );
      // SEC-04: desactivar o MFA termina as sessões abertas.
      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' }, data: { versaoSessao: { increment: 1 } },
      });
    });

    it('SEC-03: recusa desactivar o MFA a um papel clínico', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET', role: 'enfermeiro',
      });
      await expect(service.desativarMfa('user-id-1', '123456')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.utilizador.update).not.toHaveBeenCalled();
    });
  });

  // ── logout() ─────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('SEC-04: termina todas as sessões do dono do refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ utilizadorId: 'u1' });

      const resultado = await service.logout('my-refresh-token');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith({
        where: { id: 'u1' }, data: { versaoSessao: { increment: 1 } },
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { utilizadorId: 'u1', revogado: false }, data: { revogado: true },
      });
      expect(resultado).toMatchObject({ mensagem: 'Sessão terminada' });
    });

    it('com refresh token desconhecido não mexe em nenhuma conta', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.logout('desconhecido')).resolves.toMatchObject({ mensagem: 'Sessão terminada' });
      expect(mockPrisma.utilizador.update).not.toHaveBeenCalled();
    });
  });

  // ── getMe() ───────────────────────────────────────────────────────────────────

  describe('getMe()', () => {
    it('consulta utilizador com o select correcto', async () => {
      const perfil = {
        id: '1', nome: 'Dr. Teste', numeroFuncionario: '12345',
        role: 'medico', subRole: null, servico: 'medicina', mfaAtivo: true,
      };
      mockPrisma.utilizador.findUnique.mockResolvedValue(perfil);

      const resultado = await service.getMe('1');

      expect(mockPrisma.utilizador.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          select: expect.objectContaining({
            id: true, nome: true, role: true, mfaAtivo: true,
          }),
        }),
      );
      expect(resultado).toEqual(perfil);
    });
  });

  // ── refresh() ────────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('lança UnauthorizedException para token inexistente', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token-invalido')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para token revogado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 'tok', revogado: true, expiresAt: new Date(Date.now() + 1000), utilizadorId: '1',
      });

      await expect(service.refresh('tok')).rejects.toThrow(UnauthorizedException);
      // Reuse-detection invalida também os access tokens (SEC-04).
      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith({
        where: { id: '1' }, data: { versaoSessao: { increment: 1 } },
      });
    });

    it('SEC-03: recusa renovar a sessão de um papel clínico sem MFA', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 'tok', revogado: false, expiresAt: new Date(Date.now() + 86400000), utilizadorId: '1',
      });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, role: 'medico',
        nome: 'Dr.', numeroFuncionario: '1', servico: 'medicina', versaoSessao: 0,
      });
      await expect(service.refresh('tok')).rejects.toThrow(/MFA obrigatório/);
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('lança UnauthorizedException para token expirado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 'tok', revogado: false, expiresAt: new Date(Date.now() - 1000), utilizadorId: '1',
      });

      await expect(service.refresh('tok')).rejects.toThrow(UnauthorizedException);
    });

    it('revoga token antigo e devolve novos tokens', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 'tok-antigo', revogado: false,
        expiresAt: new Date(Date.now() + 86400000), utilizadorId: '1',
      });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: true, role: 'enfermeiro',
        nome: 'Ana', numeroFuncionario: '22222', servico: 'cirurgia', versaoSessao: 0,
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'tok-novo' });

      const resultado = await service.refresh('tok-antigo');

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: 'tok-antigo' }, data: { revogado: true } }),
      );
      expect(resultado).toHaveProperty('accessToken');
      expect(typeof resultado.refreshToken).toBe('string');
    });
  });

  // ── alterarPassword() ────────────────────────────────────────────────────────

  describe('alterarPassword()', () => {
    it('lança UnauthorizedException quando password actual está incorreta', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', passwordHash: hashCorreto,
      });

      await expect(service.alterarPassword('1', 'passwordErrada', 'novaPassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('actualiza hash e revoga todos os refresh tokens activos', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', passwordHash: hashCorreto,
      });
      mockPrisma.utilizador.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      const resultado = await service.alterarPassword('1', 'passwordCorreta', 'novaPasswordSegura');

      expect(resultado).toMatchObject({ mensagem: 'Password alterada com sucesso' });
      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordExpiresAt: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { utilizadorId: '1', revogado: false }, data: { revogado: true } }),
      );
    });
  });

  // ── passwordStatus() ──────────────────────────────────────────────────────────

  describe('passwordStatus()', () => {
    it('devolve expira=false quando passwordExpiresAt é null', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ passwordExpiresAt: null });

      const resultado = await service.passwordStatus('1');

      expect(resultado).toEqual({ expira: false, diasRestantes: null });
    });

    it('devolve expira=true quando a password já expirou', async () => {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.utilizador.findUnique.mockResolvedValue({ passwordExpiresAt: ontem });

      const resultado = await service.passwordStatus('1');

      expect(resultado.expira).toBe(true);
      expect(resultado.diasRestantes).toBeLessThanOrEqual(0);
    });

    it('devolve aviso=true e expira=false quando expira em ≤10 dias', async () => {
      const em5Dias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.utilizador.findUnique.mockResolvedValue({ passwordExpiresAt: em5Dias });

      const resultado = await service.passwordStatus('1');

      expect(resultado.expira).toBe(false);
      expect(resultado.aviso).toBe(true);
      expect(resultado.diasRestantes).toBeGreaterThan(0);
      expect(resultado.diasRestantes).toBeLessThanOrEqual(10);
    });
  });
});
