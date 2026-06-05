import { Module } from '@nestjs/common';
import { BalancoHidricoService } from './balanco-hidrico.service';
import { BalancoHidricoController } from './balanco-hidrico.controller';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [DoenteModule],
  controllers: [BalancoHidricoController],
  providers: [BalancoHidricoService],
  exports: [BalancoHidricoService],
})
export class BalancoHidricoModule {}
