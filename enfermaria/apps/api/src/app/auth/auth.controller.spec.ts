import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockAuthService = {
  login: jest.fn(),
  verificarMfaLogin: jest.fn(),
  setupMfa: jest.fn(),
  ativarMfa: jest.fn(),
  desativarMfa: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  passwordStatus: jest.fn(),
  alterarPassword: jest.fn(),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockGuard.canActivate.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(ThrottlerGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── POST /login ───────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('define cookies de acesso quando mfaPendente=false', async () => {
      const mockRes = { cookie: jest.fn() };
      mockAuthService.login.mockResolvedValue({
        mfaPendente: false,
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        utilizador: { id: '1', nome: 'Admin' },
      });

      await controller.login(
        { numeroFuncionario: '12345', password: 'pass' } as any,
        mockRes as any,
        { ip: '127.0.0.1' } as any,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith('12345', 'pass', '127.0.0.1');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });

    it('não define cookies quando mfaPendente=true', async () => {
      const mockRes = { cookie: jest.fn() };
      mockAuthService.login.mockResolvedValue({
        mfaPendente: true,
        mfaChallengeToken: 'challenge-tok',
      });

      const resultado = await controller.login(
        { numeroFuncionario: '12345', password: 'pass' } as any,
        mockRes as any,
        { ip: '127.0.0.1' } as any,
      );

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(resultado).toMatchObject({ mfaPendente: true });
    });
  });

  // ── POST /refresh ─────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('retorna 401 quando não há cookie de refresh', async () => {
      const mockRes = {
        clearCookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.refresh({ cookies: {} } as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('actualiza cookies quando token válido está presente', async () => {
      const mockRes = { cookie: jest.fn() };
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        utilizador: { id: '1' },
      });

      await controller.refresh(
        { cookies: { refresh_token: 'valid-refresh-tok' } } as any,
        mockRes as any,
      );

      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid-refresh-tok');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });
  });

  // ── POST /logout ──────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('chama authService.logout e limpa cookies', async () => {
      const mockRes = { clearCookie: jest.fn() };
      mockAuthService.logout.mockResolvedValue({ mensagem: 'Sessão terminada' });

      const resultado = await controller.logout(
        { cookies: { refresh_token: 'tok' } } as any,
        mockRes as any,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('tok');
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(resultado).toMatchObject({ mensagem: 'Sessão terminada' });
    });
  });

  // ── GET /me ───────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('chama authService.getMe com req.user.sub', async () => {
      const perfil = { id: '1', nome: 'Admin', role: 'ti' };
      mockAuthService.getMe.mockResolvedValue(perfil);

      const resultado = await controller.me({ user: { sub: 'user-1' } } as any);

      expect(mockAuthService.getMe).toHaveBeenCalledWith('user-1');
      expect(resultado).toEqual(perfil);
    });
  });

  // ── POST /mfa/verificar ───────────────────────────────────────────────────────

  describe('mfaVerificar()', () => {
    it('define cookies após verificação MFA bem sucedida', async () => {
      const mockRes = { cookie: jest.fn() };
      mockAuthService.verificarMfaLogin.mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        utilizador: { id: '1', nome: 'Dr.' },
      });

      await controller.mfaVerificar(
        { mfaChallengeToken: 'challenge', code: '123456' },
        mockRes as any,
      );

      expect(mockAuthService.verificarMfaLogin).toHaveBeenCalledWith('challenge', '123456');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });
  });
});
