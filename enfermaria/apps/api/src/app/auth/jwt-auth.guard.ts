import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { TIPOS_TOKEN_KEY } from './tipos-token.decorator';
import type { TipoToken } from './token-audiences';

/** Sem `@TiposToken()`, um endpoint só aceita uma sessão de funcionário completa. */
const TIPOS_POR_OMISSAO: TipoToken[] = ['pessoal'];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) Passport: assinatura, expiração, issuer e audiência (ver `JwtStrategy`).
    const autenticado = (await super.canActivate(context)) as boolean;
    if (!autenticado) return false;

    // 2) SEC-03: o tipo de token tem de ser um dos que ESTE endpoint aceita.
    //    Aplica-se a toda a API por ser o guard que todos os controladores já usam —
    //    não é preciso anotar 13 controladores um a um para os proteger.
    const permitidos =
      this.reflector.getAllAndOverride<TipoToken[]>(TIPOS_TOKEN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? TIPOS_POR_OMISSAO;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.tipoToken || !permitidos.includes(user.tipoToken)) {
      throw new UnauthorizedException('Este token não é válido para este endpoint');
    }

    return true;
  }
}
