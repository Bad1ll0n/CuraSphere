import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AUD_PORTAL, JWT_ISSUER } from '../auth/token-audiences';

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, 'portal-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.portal_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      // SEC-01: audiência exclusiva do portal. Um access token de pessoal (aud
      // 'curasphere') deixa de ser aceite aqui, e — mais importante — o token do
      // portal deixa de ser aceite pela estratégia do pessoal.
      audience: AUD_PORTAL,
    });
  }

  async validate(payload: { sub: string; doenteId: string; tipo: string }) {
    if (payload.tipo !== 'portal') throw new UnauthorizedException('Token inválido para o portal');
    return { sub: payload.sub, doenteId: payload.doenteId, tipo: 'portal' };
  }
}
