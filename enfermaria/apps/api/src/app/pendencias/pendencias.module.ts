import { Module } from '@nestjs/common';
import { PendenciasService } from './pendencias.service';
import { PendenciasController } from './pendencias.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, AlertasModule, NotificacoesModule],
  controllers: [PendenciasController],
  providers: [PendenciasService],
  exports: [PendenciasService],
})
export class PendenciasModule {}
