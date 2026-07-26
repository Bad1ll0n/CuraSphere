import { Module } from '@nestjs/common';
import { MaternidadeController } from './maternidade.controller';
import { MaternidadeService } from './maternidade.service';
import { AlertasModule } from '../alertas/alertas.module';
import { DoenteModule } from '../doentes/doentes.module';

// Módulo Maternidade/Obstetrícia: registo de gravidez (idade gestacional + DPP), partograma
// (com alerta de FC fetal anormal via AlertasService) e registo de parto.
@Module({
  imports: [AlertasModule, DoenteModule],
  controllers: [MaternidadeController],
  providers: [MaternidadeService],
})
export class MaternidadeModule {}
