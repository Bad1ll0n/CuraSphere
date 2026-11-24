import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';
import { RequestContextService } from './request-context.service';
import { InstalacaoUnicaService } from './instalacao-unica.service';

@Global()
@Module({
  providers: [PrismaService, TenantContextService, RequestContextService, InstalacaoUnicaService],
  exports: [PrismaService, TenantContextService, RequestContextService],
})
export class PrismaModule {}
