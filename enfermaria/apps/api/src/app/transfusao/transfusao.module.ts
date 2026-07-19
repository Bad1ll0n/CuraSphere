import { Module } from '@nestjs/common';
import { TransfusaoService } from './transfusao.service';
import { TransfusaoController } from './transfusao.controller';
import { DoenteModule } from '../doentes/doentes.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [DoenteModule, AlertasModule],
  controllers: [TransfusaoController],
  providers: [TransfusaoService],
  exports: [TransfusaoService],
})
export class TransfusaoModule {}
