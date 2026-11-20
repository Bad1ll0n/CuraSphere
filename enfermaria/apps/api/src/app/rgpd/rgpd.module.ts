import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { RgpdController } from './rgpd.controller';
import { RgpdService } from './rgpd.service';

/** SEC-20 — direitos do titular e retenção (AuditModule é global). */
@Module({
  imports: [PrismaModule, NotificacoesModule],
  controllers: [RgpdController],
  providers: [RgpdService],
  exports: [RgpdService],
})
export class RgpdModule {}
