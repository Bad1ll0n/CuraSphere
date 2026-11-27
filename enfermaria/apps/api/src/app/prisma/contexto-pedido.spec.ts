import { of, firstValueFrom } from 'rxjs';
import { RequestContextService } from './request-context.service';
import { TenantContextService } from './tenant-context.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { TenantMiddleware } from './tenant.middleware';
import { ContextoPedidoInterceptor } from './contexto-pedido.interceptor';

// SEC-07: o "quem" e o tenant vêm da sessão verificada, nunca de um Bearer por verificar.
describe('contexto do pedido (SEC-07)', () => {
  const reqCtx = new RequestContextService();
  const tenant = new TenantContextService();
  const mwCtx = new RequestContextMiddleware(reqCtx);
  const mwTenant = new TenantMiddleware(tenant);
  const interceptor = new ContextoPedidoInterceptor(reqCtx, tenant);

  // JWT `alg:none` forjado: B, outro hospital.
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forjado = `${b64({ alg: 'none' })}.${b64({ sub: 'B', nome: 'Intruso', role: 'medico', tenantId: 'outro-hospital' })}.`;

  const correr = (req: any) =>
    new Promise<{ userId: string | null; tenantId: string }>((resolve) => {
      mwCtx.use(req, {} as any, () =>
        mwTenant.use(req, {} as any, async () => {
          const ctx = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) } as any;
          await firstValueFrom(interceptor.intercept(ctx, { handle: () => of(null) }));
          resolve({ userId: reqCtx.get()?.userId ?? null, tenantId: tenant.tenantId });
        }),
      );
    });

  it('cookie de A + Bearer forjado de B ⇒ contexto de A', async () => {
    const r = await correr({
      ip: '10.0.0.1',
      headers: { authorization: `Bearer ${forjado}` },
      user: { sub: 'A', nome: 'Ana', role: 'enfermeiro', tenantId: 'default' }, // vindo da estratégia JWT (cookie)
    });
    expect(r).toEqual({ userId: 'A', tenantId: 'default' });
  });

  it('sessão do portal: sem utilizadorId (a conta do doente não é um utilizador), autoria no nome', async () => {
    const r = await correr({ ip: '10.0.0.1', headers: {}, user: { sub: 'conta-portal-1', doenteId: 'd1', tipo: 'portal' } });
    expect(r.userId).toBeNull();
  });

  it('sem sessão, o Bearer forjado não define utilizador nem tenant', async () => {
    const r = await correr({ ip: '10.0.0.1', headers: { authorization: `Bearer ${forjado}` } });
    expect(r).toEqual({ userId: null, tenantId: 'default' });
  });

  it('o tenant da sessão verificada é aplicado', async () => {
    const r = await correr({ ip: '10.0.0.1', headers: {}, user: { sub: 'C', role: 'medico', tenantId: 'hospital-2' } });
    expect(r).toEqual({ userId: 'C', tenantId: 'hospital-2' });
  });
});
