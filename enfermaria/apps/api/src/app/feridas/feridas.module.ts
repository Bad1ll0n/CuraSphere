import { Module } from '@nestjs/common';
import { FeridasService } from './feridas.service';
import { FeridasController } from './feridas.controller';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [DoenteModule],
  controllers: [FeridasController],
  providers: [FeridasService],
  exports: [FeridasService],
})
export class FeridasModule {}
