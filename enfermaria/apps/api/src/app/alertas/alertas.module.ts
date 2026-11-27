import { Module } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { EscalacaoAlertasService } from './escalacao-alertas.service';
import { AlertasController } from './alertas.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { GatewayModule } from '../gateway/gateway.module';
import { PrismaModule } from '../prisma/prisma.module';

// ARQ-18: havia um ciclo DoenteModule → AiClinicoModule → AlertasModule → DoenteModule, só para
// o controller verificar o acesso ao doente. Agora usa o token VERIFICADOR_ACESSO_DOENTE (como
// o gateway), que o DoenteModule fornece — o AlertasModule deixa de importar o DoenteModule.
@Module({
  imports: [PrismaModule, NotificacoesModule, GatewayModule],
  controllers: [AlertasController],
  providers: [AlertasService, EscalacaoAlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
