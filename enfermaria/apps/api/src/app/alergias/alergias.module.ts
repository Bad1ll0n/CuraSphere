import { Module } from '@nestjs/common';
import { AlergiasService } from './alergias.service';
import { AlergiasController } from './alergias.controller';

@Module({
  controllers: [AlergiasController],
  providers: [AlergiasService],
  exports: [AlergiasService],
})
export class AlergiasModule {}
