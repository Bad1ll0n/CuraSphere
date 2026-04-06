import { Module } from '@nestjs/common';
import { UtilizadoresService } from './utilizadores.service';
import { UtilizadoresController } from './utilizadores.controller';

@Module({
  controllers: [UtilizadoresController],
  providers: [UtilizadoresService],
  exports: [UtilizadoresService],
})
export class UtilizadoresModule {}
