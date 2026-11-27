import { Module } from '@nestjs/common';
import { MonitorizacaoService } from './monitorizacao.service';
import { MonitorizacaoController } from './monitorizacao.controller';
import { LeiturasMonitorService } from './leituras-monitor.service';
import { SinaisVitaisModule } from '../sinais-vitais/sinais-vitais.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [SinaisVitaisModule, AlertasModule],
  controllers: [MonitorizacaoController],
  providers: [MonitorizacaoService, LeiturasMonitorService],
  exports: [LeiturasMonitorService],
})
export class MonitorizacaoModule {}
