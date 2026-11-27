import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { moduloDaRotaApi } from '@org/shared';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * PROD-20 — guarda global: um pedido a uma rota de um módulo opcional desligado (flag
 * `modulo.<id>` a `false`) recebe 404, como se o módulo não existisse. Corre antes da
 * autenticação porque não depende do utilizador. Os módulos e os prefixos estão em
 * `libs/shared/src/lib/modulos.ts`.
 */
@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(private readonly flags: FeatureFlagsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const modulo = moduloDaRotaApi(req.path ?? req.url ?? '');
    if (!modulo) return true;
    if (await this.flags.moduloLigado(modulo.id)) return true;
    throw new NotFoundException('Recurso não encontrado');
  }
}
