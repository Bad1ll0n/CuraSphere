import { Module } from '@nestjs/common';
import { UrgenciaController } from './urgencia.controller';
import { UrgenciaService } from './urgencia.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { GatewayModule } from '../gateway/gateway.module';
import { CamasModule } from '../camas/camas.module';

@Module({
  imports: [PrismaModule, NotificacoesModule, GatewayModule, CamasModule],
  controllers: [UrgenciaController],
  providers: [UrgenciaService],
})
export class UrgenciaModule {}
