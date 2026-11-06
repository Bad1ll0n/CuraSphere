import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AUDIENCIAS_PESSOAL, JWT_ISSUER, type TipoToken } from './token-audiences';
import { PrismaService } from '../prisma/prisma.service';
import { gravarCacheSessao, lerCacheSessao, type EstadoSessao } from './sessao-cache';

interface PayloadPessoal {
  sub: string;
  tipo?: TipoToken;
  /** Versão da sessão (SEC-04) — tem de coincidir com `Utilizador.versaoSessao`. */
  sv?: number;
  nome?: string;
  numeroFuncionario?: string;
  role?: string;
  subRole?: string;
  servico?: string;
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      // Pinning explícito do algoritmo — impede ataques "alg: none" e algorithm-confusion
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      // SEC-01: só as audiências do domínio "pessoal". Um token do portal do doente
      // (aud 'curasphere-portal') ou um desafio de MFA (aud 'curasphere-mfa-challenge')
      // falha aqui, apesar de estar assinado com o mesmo segredo.
      audience: AUDIENCIAS_PESSOAL,
    });
  }

  async validate(payload: PayloadPessoal) {
    // SEC-03: a claim `tipo` é obrigatória e determina o que o token pode fazer.
    // Tokens sem `tipo` são de um esquema anterior à separação de domínios — recusados.
    switch (payload.tipo) {
      case 'pessoal': {
        // Uma sessão de pessoal sem `role` não existe; se chegar aqui, o token é forjado
        // ou de outro domínio. Recusar em vez de deixar passar com role indefinido — era
        // isso que fazia o `RolesGuard` (que devolve `true` na ausência de `@Roles`)
        // conceder acesso a 13 controladores.
        if (!payload.role || !payload.servico) {
          throw new UnauthorizedException('Token de pessoal incompleto');
        }
        // SEC-04: logout, desactivação e mudança de papel/password/MFA incrementam a
        // versão da sessão; os access tokens emitidos antes deixam de valer de imediato
        // (e não só quando expiram).
        const estado = await this.estadoSessao(payload.sub);
        if (!estado || !estado.ativo || typeof payload.sv !== 'number' || payload.sv !== estado.versaoSessao) {
          throw new UnauthorizedException('Sessão terminada. Faça login novamente.');
        }
        return {
          sub: payload.sub,
          nome: payload.nome,
          numeroFuncionario: payload.numeroFuncionario,
          role: payload.role,
          subRole: payload.subRole,
          servico: payload.servico,
          tenantId: payload.tenantId ?? 'default',
          tipoToken: 'pessoal' as const,
        };
      }
      case 'mfa_setup':
      case 'password_expirada':
        // Tokens intermédios: identificam o utilizador mas NÃO transportam papel.
        // O `JwtAuthGuard` só os deixa passar nos endpoints que os declaram
        // explicitamente via `@TiposToken()`.
        return { sub: payload.sub, tipoToken: payload.tipo };
      default:
        throw new UnauthorizedException('Token inválido para esta API');
    }
  }

  private async estadoSessao(utilizadorId: string): Promise<EstadoSessao | null> {
    const emCache = lerCacheSessao(utilizadorId);
    if (emCache) return emCache;
    const u = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { versaoSessao: true, ativo: true },
    });
    if (!u) return null;
    gravarCacheSessao(utilizadorId, u);
    return u;
  }
}
