import { Module } from '@nestjs/common';
import { PlaneamentoAltaService } from './planeamento-alta.service';
import { PlaneamentoAltaController } from './planeamento-alta.controller';

/** PROD-13 — planeamento de alta e continuidade de cuidados (RNCCI, CSP, ensinos). */
@Module({
  controllers: [PlaneamentoAltaController],
  providers: [PlaneamentoAltaService],
  exports: [PlaneamentoAltaService],
})
export class PlaneamentoAltaModule {}
