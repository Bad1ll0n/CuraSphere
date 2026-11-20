import { Module } from '@nestjs/common';
import { BreakGlassService } from './break-glass.service';
import { BreakGlassController } from './break-glass.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { AtribuicoesModule } from '../atribuicoes/atribuicoes.module';

@Module({
  imports: [NotificacoesModule, AtribuicoesModule],
  controllers: [BreakGlassController],
  providers: [BreakGlassService],
  exports: [BreakGlassService],
})
export class BreakGlassModule {}
