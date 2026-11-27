import { Module } from '@nestjs/common';
import { PortalDoenteService } from './portal-doente.service';
import { PortalDoenteController } from './portal-doente.controller';
import { PortalJwtStrategy } from './portal-jwt.strategy';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../common/infra/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/infra/pdf.service';
import { ConsentimentosTratamentoModule } from '../consentimentos-tratamento/consentimentos-tratamento.module';
import { RgpdModule } from '../rgpd/rgpd.module';
import { MailerModule } from '../mailer/mailer.module';
import { PortalRecuperacaoService } from './portal-recuperacao.service';

@Module({
  imports: [AuthModule, StorageModule, PrismaModule, ConsentimentosTratamentoModule, RgpdModule, MailerModule],
  controllers: [PortalDoenteController],
  providers: [PortalDoenteService, PortalRecuperacaoService, PortalJwtStrategy, PdfService],
})
export class PortalDoenteModule {}
