import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Res, Req, Query,
  UseGuards, Logger,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsString, IsIn, IsObject, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import * as xml2js from 'xml2js';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { Roles } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

class CriarProviderDto {
  @IsString() @IsIn(['saml', 'oidc']) tipo: string;
  @IsString() @MaxLength(100) nome: string;
  @IsObject() config: Record<string, unknown>;
}

class ActualizarProviderDto {
  @IsOptional() @IsString() @MaxLength(100) nome?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

const COOKIE_MAX_AGE_ACCESS  = 60 * 60 * 1000;
const COOKIE_MAX_AGE_REFRESH = 7 * 24 * 60 * 60 * 1000;

@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly sso: SsoService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Listagem pública de providers (para mostrar no login) ───────────────

  @Get('providers')
  listarProviders() {
    return this.sso.listarProviders();
  }

  // ─── Gestão de providers (admin) ─────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'direcao')
  @Post('providers')
  criarProvider(@Body() dto: CriarProviderDto) {
    return this.sso.criarProvider(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'direcao')
  @Put('providers/:id')
  actualizarProvider(@Param('id') id: string, @Body() dto: ActualizarProviderDto) {
    return this.sso.actualizarProvider(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'direcao')
  @Delete('providers/:id')
  eliminarProvider(@Param('id') id: string) {
    return this.sso.eliminarProvider(id);
  }

  // ─── Fluxo SAML 2.0 ───────────────────────────────────────────────────────

  @Get('saml/metadata')
  async samlMetadata(@Res() res: Response) {
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3333';
    const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${apiUrl}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
    AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${apiUrl}/v1/auth/sso/saml/callback"
      index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
    res.type('text/xml').send(metadata);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('saml/login')
  async samlLogin(@Query('providerId') providerId: string, @Res() res: Response) {
    const provider = await this.sso.getProvider(providerId);
    const config = provider.config as Record<string, string>;

    if (provider.tipo !== 'saml') {
      return res.status(400).json({ mensagem: 'Provider não é SAML' });
    }

    // Construir AuthnRequest simplificado
    const state = crypto.randomBytes(16).toString('hex');
    await this.redis.set(`sso:saml:state:${state}`, providerId, 300);

    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3333';
    const acsUrl = encodeURIComponent(`${apiUrl}/v1/auth/sso/saml/callback`);
    const issuer = encodeURIComponent(apiUrl);
    const entryPoint = config['entryPoint'] ?? '';

    // Redirect para IdP com AuthnRequest básico (sem assinatura — simplificado)
    res.redirect(`${entryPoint}?SAMLRequest=...&RelayState=${state}&ACSUrl=${acsUrl}&Issuer=${issuer}`);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Post('saml/callback')
  async samlCallback(@Body() body: any, @Res() res: Response) {
    try {
      const samlResponse = Buffer.from(body.SAMLResponse, 'base64').toString('utf-8');
      const parsed = await xml2js.parseStringPromise(samlResponse);

      // Extrair atributos da assertion
      const assertion = parsed?.['samlp:Response']?.['saml:Assertion']?.[0]
        ?? parsed?.['saml:Assertion']?.[0]
        ?? parsed?.['Response']?.['Assertion']?.[0];

      const subject = assertion?.['saml:Subject']?.[0]?.['saml:NameID']?.[0]?._ ??
        assertion?.['Subject']?.[0]?.['NameID']?.[0]?._;

      const attrs: Record<string, string> = {};
      const attrStmts = assertion?.['saml:AttributeStatement']?.[0]?.['saml:Attribute'] ?? [];
      for (const attr of attrStmts) {
        const name = attr.$?.Name ?? '';
        const value = attr['saml:AttributeValue']?.[0]?._ ?? attr['saml:AttributeValue']?.[0] ?? '';
        attrs[name] = String(value);
      }

      const utilizador = await this.sso.provisionarUtilizador({
        id: subject ?? `saml:${Date.now()}`,
        email: attrs['email'] ?? attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        nome: attrs['displayName'] ?? attrs['name'] ?? attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
        role: attrs['role'] ?? attrs['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      });

      const { accessToken, refreshToken } = this.sso.emitirTokens(utilizador);
      this.setCookies(res, accessToken, refreshToken);

      const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:4200';
      res.redirect(webUrl);
    } catch (err) {
      this.logger.error('SAML callback error', err);
      const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:4200';
      res.redirect(`${webUrl}/login?erro=sso_failed`);
    }
  }

  // ─── Fluxo OIDC ──────────────────────────────────────────────────────────

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('oidc/login')
  async oidcLogin(@Query('providerId') providerId: string, @Res() res: Response) {
    const provider = await this.sso.getProvider(providerId);
    if (provider.tipo !== 'oidc') {
      return res.status(400).json({ mensagem: 'Provider não é OIDC' });
    }

    const config = provider.config as Record<string, string>;
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    await this.redis.set(`sso:oidc:state:${state}`, JSON.stringify({ providerId, nonce }), 300);

    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3333';
    const redirectUri = encodeURIComponent(`${apiUrl}/v1/auth/sso/oidc/callback`);
    const clientId = encodeURIComponent(config['clientId'] ?? '');
    const scope = encodeURIComponent('openid profile email');
    const authEndpoint = config['authorizationEndpoint'] ?? `${config['issuer']}/oauth2/v2.0/authorize`;

    res.redirect(
      `${authEndpoint}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&nonce=${nonce}`,
    );
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Get('oidc/callback')
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const stateData = await this.redis.get<string>(`sso:oidc:state:${state}`);
      if (!stateData) throw new Error('State inválido ou expirado');

      const { providerId } = JSON.parse(stateData);
      const provider = await this.sso.getProvider(providerId);
      const config = provider.config as Record<string, string>;

      const apiUrl = process.env['API_URL'] ?? 'http://localhost:3333';
      const redirectUri = `${apiUrl}/v1/auth/sso/oidc/callback`;
      const tokenEndpoint = config['tokenEndpoint'] ?? `${config['issuer']}/oauth2/v2.0/token`;

      // Trocar code por tokens
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: config['clientId'] ?? '',
          client_secret: config['clientSecret'] ?? '',
        }),
      });

      if (!tokenResponse.ok) throw new Error('Falha ao trocar code por tokens');
      const tokens = await tokenResponse.json();

      // Decode id_token (JWT — verificação simplificada de claims)
      const idToken = tokens.id_token;
      const [, payloadB64] = idToken.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

      const utilizador = await this.sso.provisionarUtilizador({
        id: payload.sub ?? payload.oid,
        email: payload.email ?? payload.preferred_username,
        nome: payload.name ?? payload.display_name,
        role: payload.roles?.[0] ?? payload.role,
      });

      await this.redis.del(`sso:oidc:state:${state}`);
      const { accessToken, refreshToken } = this.sso.emitirTokens(utilizador);
      this.setCookies(res, accessToken, refreshToken);

      const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:4200';
      res.redirect(webUrl);
    } catch (err) {
      this.logger.error('OIDC callback error', err);
      const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:4200';
      res.redirect(`${webUrl}/login?erro=sso_failed`);
    }
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env['NODE_ENV'] === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const, path: '/' };
    res.cookie('access_token',  accessToken,  { ...base, maxAge: COOKIE_MAX_AGE_ACCESS });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: COOKIE_MAX_AGE_REFRESH });
  }
}
