import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { FhirController } from './fhir.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SinaisVitaisModule } from '../sinais-vitais/sinais-vitais.module';

@Module({
  imports: [PrismaModule, SinaisVitaisModule],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
