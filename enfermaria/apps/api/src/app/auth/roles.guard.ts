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
    const roleOk    = !requiredRoles    || requiredRoles.includes(user.role);
    const subRoleOk = !requiredSubRoles || (user.subRole && requiredSubRoles.includes(user.subRole));

    return roleOk && subRoleOk;
  }
}
