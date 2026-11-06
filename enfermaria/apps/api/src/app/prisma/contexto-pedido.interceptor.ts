import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';
import { TenantContextService } from './tenant-context.service';

/**
 * SEC-07 — o "quem" do pedido (auditoria) e o tenant vêm SÓ da sessão verificada.
 *
 * Antes, dois middlewares descodificavam o `Authorization: Bearer` em base64, sem verificar a
 * assinatura, e corriam ANTES da autenticação (que usa o cookie primeiro). Um pedido com o
 * cookie válido de A e um Bearer forjado de B era autenticado como A, mas filtrado pelo tenant
 * de B e auditado em nome de B. E, na web (só cookie), a autoria ficava sempre `null`.
 *
 * Os middlewares passaram a abrir apenas o contexto (vazio, com IP/user-agent/correlação).
 * Este interceptor corre DEPOIS dos guards — `req.user` já foi validado pela estratégia JWT —
 * e é ele que preenche o utilizador e o tenant. Rotas sem sessão ficam com o contexto vazio.
 */
@Injectable()
export class ContextoPedidoInterceptor implements NestInterceptor {
  constructor(
    private readonly reqCtx: RequestContextService,
    private readonly tenant: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const u = req?.user as { sub?: string; nome?: string; role?: string; tenantId?: string } | undefined;
      if (u?.sub) {
        this.reqCtx.definirUtilizador({ userId: u.sub, nome: u.nome ?? null, role: u.role ?? null });
        if (u.tenantId) this.tenant.definir(u.tenantId);
      }
    }
    return next.handle();
  }
}
