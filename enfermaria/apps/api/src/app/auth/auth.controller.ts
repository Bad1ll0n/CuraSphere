import { Controller, Post, Get, Body, Patch, UseGuards, Request, Res } from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { IsString, IsNotEmpty, Length } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AlterarPasswordDto } from './dto/alterar-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

class MfaVerificarDto {
  @IsString() @IsNotEmpty() mfaChallengeToken: string;
  @IsString() @Length(6, 6) code: string;
}

class MfaAtivarDto {
  @IsString() @IsNotEmpty() secret: string;
  @IsString() @Length(6, 6) code: string;
}

class MfaDesativarDto {
  @IsString() @Length(6, 6) code: string;
}

const COOKIE_MAX_AGE_ACCESS  = 60 * 60 * 1000;
const COOKIE_MAX_AGE_REFRESH = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.numeroFuncionario, dto.password);
    if (result.mfaPendente) {
      return { mfaPendente: true, mfaChallengeToken: result.mfaChallengeToken };
    }
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { utilizador: result.utilizador };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600000, limit: 10 } })
  @Post('mfa/verificar')
  async mfaVerificar(
    @Body() dto: MfaVerificarDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verificarMfaLogin(dto.mfaChallengeToken, dto.code);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { utilizador: result.utilizador };
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('mfa/setup')
  mfaSetup(@Request() req: any) {
    return this.authService.setupMfa(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Post('mfa/ativar')
  mfaAtivar(@Request() req: any, @Body() dto: MfaAtivarDto) {
    return this.authService.ativarMfa(req.user.sub, dto.secret, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Post('mfa/desativar')
  mfaDesativar(@Request() req: any, @Body() dto: MfaDesativarDto) {
    return this.authService.desativarMfa(req.user.sub, dto.code);
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token;
    if (!token) {
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      return res.status(401).json({ mensagem: 'Sessão expirada. Faça login novamente.' });
    }
    const result = await this.authService.refresh(token);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { utilizador: result.utilizador };
  }

  @SkipThrottle()
  @Post('logout')
  async logout(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token;
    if (token) await this.authService.logout(token);
    res.clearCookie('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
    res.clearCookie('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
    return { mensagem: 'Sessão terminada' };
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('me')
  me(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('password-status')
  async passwordStatus(@Request() req: any) {
    return this.authService.passwordStatus(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('alterar-password')
  async alterarPassword(
    @Request() req: any,
    @Body() dto: AlterarPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.alterarPassword(req.user.sub, dto.passwordAtual, dto.novaPassword);
    res.clearCookie('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
    res.clearCookie('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
    return result;
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie('access_token',  accessToken,  { ...base, maxAge: COOKIE_MAX_AGE_ACCESS });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: COOKIE_MAX_AGE_REFRESH });
  }
}
