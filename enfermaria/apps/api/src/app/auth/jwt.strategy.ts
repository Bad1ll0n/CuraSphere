import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      // Pinning explícito do algoritmo — impede ataques "alg: none" e algorithm-confusion
      algorithms: ['HS256'],
      issuer: 'curasphere-api',
      audience: 'curasphere',
    });
  }

  async validate(payload: { sub: string; nome: string; numeroFuncionario: string; role: string; subRole?: string; servico: string }) {
    return { sub: payload.sub, nome: payload.nome, numeroFuncionario: payload.numeroFuncionario, role: payload.role, subRole: payload.subRole, servico: payload.servico };
  }
}
