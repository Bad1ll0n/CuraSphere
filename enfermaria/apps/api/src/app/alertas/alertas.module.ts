import { Module, forwardRef } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { AlertasController } from './alertas.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { GatewayModule } from '../gateway/gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DoenteModule } from '../doentes/doentes.module';

// forwardRef: DoenteModule -> AiClinicoModule -> AlertasModule -> DoenteModule
// is a real cycle (Doente needs AI insights, AI insights raise alerts, alerts
// need doente access checks) — deferring this one edge breaks the "module is
// undefined at evaluation time" failure without restructuring the other two.
@Module({
  imports: [PrismaModule, NotificacoesModule, GatewayModule, forwardRef(() => DoenteModule)],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
