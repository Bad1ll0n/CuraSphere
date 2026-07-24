import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Res, Req, Query,
  UseGuards, Logger, BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsIn, IsObject, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import * as jwksRsa from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { Roles } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';
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

  /**
   * Constrói uma instância SAML real (@node-saml/node-saml) para um provider.
   * `config.cert` (certificado público de assinatura do IdP, PEM) é obrigatório —
   * é o que torna a assinatura da Response/Assertion verificável. Sem ele, recusamos
   * o provider em vez de aceitar assertions não verificadas (ver histórico: o fluxo
   * anterior fazia parsing manual do XML sem validar a assinatura, permitindo que
   * qualquer pessoa forjasse uma SAMLResponse e autenticasse como qualquer utilizador).
   */
  private buildSaml(config: Record<string, string>): SAML {
    const cert = config['cert'];
    if (!cert) {
      throw new BadRequestException('Provider SAML sem certificado do IdP configurado (config.cert)');
    }
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3333';
    return new SAML({
      idpCert: cert,
      issuer: config['issuer'] || apiUrl,
      callbackUrl: `${apiUrl}/v1/auth/sso/saml/callback`,
      entryPoint: config['entryPoint'],
      wantAssertionsSigned: true,
      validateInResponseTo: ValidateInResponseTo.ifPresent,
    });
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('saml/login')
  async samlLogin(@Query('providerId') providerId: string, @Res() res: Response) {
    const provider = await this.sso.getProvider(providerId);

    if (provider.tipo !== 'saml') {
      return res.status(400).json({ mensagem: 'Provider não é SAML' });
    }

    const config = provider.config as Record<string, string>;
    const saml = this.buildSaml(config);

    // RelayState identifica o provider a usar quando a Response voltar no callback
    const state = crypto.randomBytes(16).toString('hex');
    await this.redis.set(`sso:saml:state:${state}`, providerId, 300);

    const url = await saml.getAuthorizeUrlAsync(state, undefined, {});
    return res.redirect(url);
  }

  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Post('saml/callback')
  async samlCallback(@Body() body: Record<string, string>, @Res() res: Response) {
    const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:4200';
    try {
      const relayState = body.RelayState;
      const providerId = relayState ? await this.redis.get<string>(`sso:saml:state:${relayState}`) : null;
      if (!providerId) throw new Error('RelayState inválido ou expirado');
      await this.redis.del(`sso:saml:state:${relayState}`);

      const provider = await this.sso.getProvider(providerId);
      const config = provider.config as Record<string, string>;
      const saml = this.buildSaml(config);

      // Verifica assinatura, validade temporal (NotBefore/NotOnOrAfter) e InResponseTo
      const { profile } = await saml.validatePostResponseAsync(body);
      if (!profile) throw new Error('Assertion SAML inválida ou sessão de logout');

      const utilizador = await this.sso.provisionarUtilizador({
        id: profile.nameID,
        email: (profile['email'] ?? profile['mail']) as string | undefined,
        nome: (profile['displayName'] ?? profile['name']) as string | undefined,
        role: (profile['role'] ?? profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) as string | undefined,
      });

      const { accessToken, refreshToken } = await this.sso.emitirTokens(utilizador);
      this.setCookies(res, accessToken, refreshToken);
      res.redirect(webUrl);
    } catch (err) {
      this.logger.error('SAML callback error', err);
      res.redirect(`${webUrl}/login?erro=sso_failed`);
    }
  }

  // ─── Fluxo OIDC ──────────────────────────────────────────────────────────

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

    return res.redirect(
      `${authEndpoint}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&nonce=${nonce}`,
    );
  }

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

      const { providerId, nonce } = JSON.parse(stateData);
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
      const tokens = await tokenResponse.json() as Record<string, any>;

      // Verifica a assinatura do id_token via JWKS do IdP (RS256) — a troca do
      // authorization code já passa por client_secret, mas o id_token em si tem
      // de ser validado (assinatura + iss/aud/exp) antes de confiar nas claims,
      // e o nonce gerado em oidcLogin tem de bater certo para impedir replay.
      const idToken = tokens.id_token;
      const decodedHeader = jwt.decode(idToken, { complete: true }) as { header: { kid?: string } } | null;
      if (!decodedHeader) throw new Error('id_token inválido');

      const issuer = config['issuer'] ?? '';
      const jwksUri = config['jwksUri'] || `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
      const jwksClient = new jwksRsa.JwksClient({ jwksUri, cache: true, cacheMaxAge: 600000 });
      const signingKey = await jwksClient.getSigningKey(decodedHeader.header.kid);

      const payload = jwt.verify(idToken, signingKey.getPublicKey(), {
        algorithms: ['RS256'],
        audience: config['clientId'],
        issuer,
      }) as Record<string, any>;

      if (!nonce || payload['nonce'] !== nonce) {
        throw new Error('nonce do id_token não corresponde ao esperado — possível replay');
      }

      const utilizador = await this.sso.provisionarUtilizador({
        id: payload.sub ?? payload.oid,
        email: payload.email ?? payload.preferred_username,
        nome: payload.name ?? payload.display_name,
        role: payload.roles?.[0] ?? payload.role,
      });

      await this.redis.del(`sso:oidc:state:${state}`);
      const { accessToken, refreshToken } = await this.sso.emitirTokens(utilizador);
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
