import { Module } from '@nestjs/common';
import { DialiseController } from './dialise.controller';
import { DialiseService } from './dialise.service';
import { AlertasModule } from '../alertas/alertas.module';
import { DoenteModule } from '../doentes/doentes.module';

// Módulo Diálise/Nefrologia: registo de sessões de hemodiálise/diálise peritoneal, ganho
// interdialítico + UF objetivo calculados, alerta de ganho ponderal excessivo via AlertasService.
@Module({
  imports: [AlertasModule, DoenteModule],
  controllers: [DialiseController],
  providers: [DialiseService],
})
export class DialiseModule {}
