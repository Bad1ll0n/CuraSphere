import { Module } from '@nestjs/common';
import { OncologiaController } from './oncologia.controller';
import { OncologiaService } from './oncologia.service';
import { AlertasModule } from '../alertas/alertas.module';
import { DoenteModule } from '../doentes/doentes.module';

// Módulo Oncologia/Quimioterapia: plano de quimio (BSA + doses por m²), ciclos com verificação
// de intervalo do protocolo e alerta de toxicidade CTCAE ≥3 via AlertasService.
@Module({
  imports: [AlertasModule, DoenteModule],
  controllers: [OncologiaController],
  providers: [OncologiaService],
})
export class OncologiaModule {}
