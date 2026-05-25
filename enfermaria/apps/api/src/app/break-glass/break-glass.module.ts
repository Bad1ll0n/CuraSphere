import { Module } from '@nestjs/common';
import { BreakGlassService } from './break-glass.service';
import { BreakGlassController } from './break-glass.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [BreakGlassController],
  providers: [BreakGlassService],
  exports: [BreakGlassService],
})
export class BreakGlassModule {}
