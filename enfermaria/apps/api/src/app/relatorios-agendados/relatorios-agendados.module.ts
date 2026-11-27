import { Module } from '@nestjs/common';
import { RelatoriosAgendadosService } from './relatorios-agendados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [PrismaModule, MailerModule],
  providers: [RelatoriosAgendadosService],
})
export class RelatoriosAgendadosModule {}
