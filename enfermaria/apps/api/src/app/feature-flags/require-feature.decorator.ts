import { SetMetadata, CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';

export const FEATURE_KEY = 'requiredFeature';

/**
 * Gate um endpoint atrás de uma feature flag. Se a flag estiver desligada para o utilizador,
 * o endpoint responde 404 (não revela a existência da funcionalidade). Usar com FeatureGuard.
 */
export const RequireFeature = (key: string) => SetMetadata(FEATURE_KEY, key);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!key) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? {};
    const on = await this.flags.isEnabled(key, { userId: user.sub, role: user.role, servico: user.servico });
    if (!on) throw new NotFoundException('Recurso não encontrado');
    return true;
  }
}
