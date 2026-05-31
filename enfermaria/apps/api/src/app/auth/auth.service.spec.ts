import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

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
};

const mockConfig = {
  get: jest.fn().mockReturnValue('7d'),
};

describe('AuthService', () => {
  let service: AuthService;

  // Hash real computado uma vez para todos os testes de password
  let hashCorreto: string;

  beforeAll(async () => {
    hashCorreto = await bcrypt.hash('passwordCorreta', 10);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    mockJwt.sign.mockReturnValue('jwt-access-token');
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token-xyz' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
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
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345',
        servico: 'medicina', passwordExpiresAt: null,
      });

      const resultado = await service.login('12345', 'passwordCorreta');

      expect(resultado.mfaPendente).toBe(false);
      expect(resultado).toHaveProperty('accessToken', 'jwt-access-token');
      // criarRefreshToken devolve crypto.randomBytes — verificamos apenas que é uma string hex
      expect(typeof resultado.refreshToken).toBe('string');
      expect(resultado.refreshToken.length).toBeGreaterThan(0);
    });

    it('sinaliza passwordExpiradoAviso quando expira em ≤10 dias', async () => {
      const em5Dias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: '1', ativo: true, mfaAtivo: false, passwordHash: hashCorreto,
        role: 'medico', nome: 'Dr. Teste', numeroFuncionario: '12345',
        servico: 'medicina', passwordExpiresAt: em5Dias,
      });

      const resultado = await service.login('12345', 'passwordCorreta') as any;

      expect(resultado.passwordExpiradoAviso).toBe(true);
      expect(resultado.diasRestantesSenha).toBeLessThanOrEqual(10);
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
      // criarRefreshToken devolve crypto.randomBytes — token gerado localmente
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
});
