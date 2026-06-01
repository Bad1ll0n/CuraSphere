import { Module } from '@nestjs/common';
import { DietasService } from './dietas.service';
import { DietasController } from './dietas.controller';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [DoenteModule],
  controllers: [DietasController],
  providers: [DietasService],
  exports: [DietasService],
})
export class DietasModule {}
