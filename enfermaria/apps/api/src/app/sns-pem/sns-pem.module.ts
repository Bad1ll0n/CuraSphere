import { Module } from '@nestjs/common';
import { SnsPemService } from './sns-pem.service';
import { SnsPemController } from './sns-pem.controller';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [DoenteModule],
  controllers: [SnsPemController],
  providers: [SnsPemService],
  exports: [SnsPemService],
})
export class SnsPemModule {}
