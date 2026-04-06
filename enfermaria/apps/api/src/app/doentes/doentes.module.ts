import { Module } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { DoenteController } from './doentes.controller';

@Module({
  controllers: [DoenteController],
  providers: [DoenteService],
  exports: [DoenteService],
})
export class DoenteModule {}
