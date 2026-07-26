import { Module } from '@nestjs/common';
import { PediatriaController } from './pediatria.controller';
import { PediatriaService } from './pediatria.service';

// Módulo Pediatria: calculadora de dose por peso + tendência de PEWS. O PEWS em si é calculado
// automaticamente na pipeline de sinais vitais (sinais-vitais.service) para doentes < 16 anos.
@Module({
  controllers: [PediatriaController],
  providers: [PediatriaService],
})
export class PediatriaModule {}
