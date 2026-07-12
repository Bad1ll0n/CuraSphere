import { Controller, Post, Get, Delete, Body, Param, Request, UseGuards, Res } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { WebAuthnService } from './webauthn.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

class RegistarVerificarDto {
  @IsString() response: any;
  @IsOptional() @IsString() @MaxLength(50) nome?: string;
}

class AutenticarVerificarDto {
  @IsString() numeroFuncionario: string;
  @IsString() response: any;
}

const COOKIE_MAX_AGE_ACCESS  = 60 * 60 * 1000;
const COOKIE_MAX_AGE_REFRESH = 7 * 24 * 60 * 60 * 1000;

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(
    private readonly webAuthn: WebAuthnService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Registo (utiliz. autenticado) ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('register/options')
  registerOptions(@Request() req: any) {
    return this.webAuthn.generateRegistrationOptions(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register/verify')
  registerVerify(@Request() req: any, @Body() dto: RegistarVerificarDto) {
    return this.webAuthn.verifyRegistration(req.user.sub, dto.response, dto.nome ?? 'Passkey');
  }

  // ─── Autenticação (sem sessão) ────────────────────────────────────────────

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('auth/options')
  async authOptions(@Body() body: { numeroFuncionario?: string }) {
    if (!body.numeroFuncionario) {
      // Sem hint: retornar opções sem allowCredentials (discoverable credential)
      const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
      return generateAuthenticationOptions({ rpID: 'localhost', userVerification: 'preferred' });
    }
    const { PrismaService } = await import('../../prisma/prisma.service');
    // Delegar ao serviço que conhece o utilizador
    return this.webAuthn.generateAuthChallengeForUser(body.numeroFuncionario as any);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Post('auth/verify')
  async authVerify(
    @Body() dto: AutenticarVerificarDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const utilizador = await this.webAuthn.verifyAuthentication(dto.response);

    // Emitir tokens JWT CuraSphere
    const payload = { sub: utilizador.id, role: utilizador.role, subRole: utilizador.subRole };
    const accessToken  = this.jwtService.sign(payload, { expiresIn: '1h' as any });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' as any });

    const isProd = process.env['NODE_ENV'] === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const, path: '/' };
    res.cookie('access_token',  accessToken,  { ...base, maxAge: COOKIE_MAX_AGE_ACCESS });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: COOKIE_MAX_AGE_REFRESH });

    return {
      utilizador: {
        id: utilizador.id,
        nome: utilizador.nome,
        role: utilizador.role,
        subRole: utilizador.subRole,
        servico: utilizador.servico,
      },
    };
  }

  // ─── Gestão de passkeys (utiliz. autenticado) ─────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('credentials')
  listar(@Request() req: any) {
    return this.webAuthn.listarCredenciais(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Delete('credentials/:id')
  remover(@Param('id') id: string, @Request() req: any) {
    return this.webAuthn.removerCredencial(id, req.user.sub);
  }
}
