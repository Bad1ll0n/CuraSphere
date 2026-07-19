import { Module } from '@nestjs/common';
import { MonitorizacaoService } from './monitorizacao.service';
import { MonitorizacaoController } from './monitorizacao.controller';
import { SinaisVitaisModule } from '../sinais-vitais/sinais-vitais.module';

@Module({
  imports: [SinaisVitaisModule],
  controllers: [MonitorizacaoController],
  providers: [MonitorizacaoService],
})
export class MonitorizacaoModule {}
