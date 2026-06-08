import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

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
      issuer: 'curasphere-api',
      audience: 'curasphere',
    });
  }

  async validate(payload: { sub: string; doenteId: string; tipo: string }) {
    if (payload.tipo !== 'portal') throw new UnauthorizedException('Token inválido para o portal');
    return { sub: payload.sub, doenteId: payload.doenteId, tipo: 'portal' };
  }
}
