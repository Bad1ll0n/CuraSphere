import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnomalyDetectionService } from '../common/anomaly-detection.service';

jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn().mockReturnValue(true),
    generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
    keyuri: jest.fn().mockReturnValue('otpauth://totp/CuraSphere:00001?secret=JBSWY3DPEHPK3PXP'),
  },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAuthenticator = require('otplib').authenticator as {
  verify: jest.Mock;
  generateSecret: jest.Mock;
  keyuri: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockQrcode = require('qrcode') as { toDataURL: jest.Mock };

const mockPrisma = {
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
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.setIfNotExists.mockResolvedValue(true);
    mockAuthenticator.verify.mockReturnValue(true);
    mockAuthenticator.generateSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
    mockAuthenticator.keyuri.mockReturnValue('otpauth://totp/CuraSphere:00001?secret=JBSWY3DPEHPK3PXP');
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
        expect.objectContaining({ expiresIn: '5m' }),
      );
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
      expect(resultado.refreshToken.length).toBeGreaterThan(0);
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
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: false });

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(
        /Token inválido/i,
      );
    });

    it('lança UnauthorizedException quando utilizador não existe', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: true });
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando mfaAtivo=false', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: true });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: false, mfaSecret: null,
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para código TOTP inválido', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: true });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });
      mockAuthenticator.verify.mockReturnValue(false);

      await expect(service.verificarMfaLogin('token', '000000')).rejects.toThrow(
        /Código MFA inválido/i,
      );
    });

    it('lança UnauthorizedException quando código TOTP é replay', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: true });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr.', numeroFuncionario: '12345', servico: 'medicina',
      });
      // código válido mas já foi usado → setIfNotExists devolve false
      mockRedis.setIfNotExists.mockResolvedValue(false);

      await expect(service.verificarMfaLogin('token', '123456')).rejects.toThrow(
        /já utilizado/i,
      );
    });

    it('devolve accessToken e refreshToken em verificação bem sucedida', async () => {
      mockJwt.verify.mockReturnValue({ sub: '1', mfaChallenge: true });
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345', servico: 'medicina',
      });

      const resultado = await service.verificarMfaLogin('token', '123456');

      expect(resultado).toHaveProperty('accessToken', 'jwt-access-token');
      expect(typeof resultado.refreshToken).toBe('string');
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
    });
  });

  // ── ativarMfa() ───────────────────────────────────────────────────────────────

  describe('ativarMfa()', () => {
    it('lança BadRequestException para código TOTP inválido', async () => {
      mockAuthenticator.verify.mockReturnValue(false);

      await expect(service.ativarMfa('user-id-1', 'SECRET', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException quando código é replay', async () => {
      mockAuthenticator.verify.mockReturnValue(true);
      mockRedis.setIfNotExists.mockResolvedValue(false);

      await expect(service.ativarMfa('user-id-1', 'SECRET', '123456')).rejects.toThrow(
        /Código já utilizado/i,
      );
    });

    it('actualiza utilizador com mfaSecret e mfaAtivo=true', async () => {
      mockAuthenticator.verify.mockReturnValue(true);
      mockRedis.setIfNotExists.mockResolvedValue(true);
      mockPrisma.utilizador.update.mockResolvedValue({});

      const resultado = await service.ativarMfa('user-id-1', 'MY-SECRET', '123456');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-1' },
          data: { mfaSecret: 'MY-SECRET', mfaAtivo: true },
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
      mockAuthenticator.verify.mockReturnValue(false);

      await expect(service.desativarMfa('user-id-1', '000000')).rejects.toThrow(BadRequestException);
    });

    it('limpa mfaSecret e define mfaAtivo=false', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', mfaAtivo: true, mfaSecret: 'SECRET',
      });
      mockAuthenticator.verify.mockReturnValue(true);
      mockRedis.setIfNotExists.mockResolvedValue(true);
      mockPrisma.utilizador.update.mockResolvedValue({});

      await service.desativarMfa('user-id-1', '123456');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-1' },
          data: { mfaSecret: null, mfaAtivo: false },
        }),
      );
    });
  });

  // ── logout() ─────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('revoga o refresh token e devolve mensagem de confirmação', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await service.logout('my-refresh-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: 'my-refresh-token', revogado: false },
          data: { revogado: true },
        }),
      );
      expect(resultado).toMatchObject({ mensagem: 'Sessão terminada' });
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
        id: '1', ativo: true, mfaAtivo: false, role: 'enfermeiro',
        nome: 'Ana', numeroFuncionario: '22222', servico: 'cirurgia',
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
