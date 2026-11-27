import { ForbiddenException } from '@nestjs/common';
import { InstalacaoUnicaService, TABELAS_COM_TENANT } from './instalacao-unica.service';
import { TenantContextService, TENANT_UNICO } from './tenant-context.service';

describe('instalação de um só hospital (ARQ-21)', () => {
  it('arranca quando todos os registos são desta instalação', async () => {
    const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ n: 0 }]) };
    await expect(new InstalacaoUnicaService(prisma).onModuleInit()).resolves.toBeUndefined();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(TABELAS_COM_TENANT.length);
  });

  it('recusa arrancar se houver dados de outro hospital', async () => {
    const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValueOnce([{ n: 3 }]).mockResolvedValue([{ n: 0 }]) };
    await expect(new InstalacaoUnicaService(prisma).onModuleInit()).rejects.toThrow(/utilizadores: 3/);
  });

  it('o contexto do pedido recusa um tenant que não é o desta instalação', () => {
    const t = new TenantContextService();
    t.runWithTenant(TENANT_UNICO, () => {
      expect(() => t.definir('hospital-b')).toThrow(ForbiddenException);
      t.definir(TENANT_UNICO);
      expect(t.tenantId).toBe(TENANT_UNICO);
    });
  });
});
