import { Module } from '@nestjs/common';
import { IncidentesTIController } from './incidentes-ti.controller';
import { IncidentesTIService } from './incidentes-ti.service';

@Module({
  controllers: [IncidentesTIController],
  providers: [IncidentesTIService],
  exports: [IncidentesTIService],
})
export class IncidentesTIModule {}
