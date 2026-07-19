import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, SUB_ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredSubRoles = this.reflector.getAllAndOverride<string[]>(SUB_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredSubRoles) return true;

    const { user } = context.switchToHttp().getRequest();

    // @Roles() corresponde ao papel base OU ao sub-papel do utilizador. Isto reflecte a
    // intenção com que os decorators foram escritos: listar 'chefe_enfermeiros' (que é um
    // sub-papel de 'enfermeiro') pretendia dar acesso à chefia de enfermagem. Como o guard
    // antes só comparava com user.role, esses utilizadores ficavam silenciosamente bloqueados
    // de ~28 endpoints (sépsis, transferências, documentos de saúde, etc.). Verificado que as
    // únicas strings de sub-papel usadas em @Roles() em toda a API são de liderança, pelo que
    // esta alteração não concede acesso indevido a nenhum outro sub-papel.
    // NOTA: @SubRoles() continua a ser um filtro AND estrito sobre user.subRole (mais restritivo).
    const roleOk    = !requiredRoles    || requiredRoles.includes(user.role) || (user.subRole && requiredRoles.includes(user.subRole));
    const subRoleOk = !requiredSubRoles || (user.subRole && requiredSubRoles.includes(user.subRole));

    return roleOk && subRoleOk;
  }
}
