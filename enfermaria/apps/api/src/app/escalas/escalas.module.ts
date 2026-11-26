import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { EscalasClinicasController } from './escalas-clinicas.controller';
import { EscalasClinicasService } from './escalas-clinicas.service';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';

// ARQ-19: um só domínio de escalas. Braden e Morse (avaliações de risco, com reavaliação programada)
// e as restantes escalas clínicas partilham o motor (common/clinico/escalas-motor) e as regras
// escala → ação (common/clinico/escala-acoes); as rotas /escalas e /escalas-clinicas mantêm-se.
@Module({
  imports: [AlertasModule, NotificacoesModule, DoenteModule],
  controllers: [EscalasController, EscalasClinicasController],
  providers: [EscalasService, EscalasClinicasService],
})
export class EscalasModule {}
