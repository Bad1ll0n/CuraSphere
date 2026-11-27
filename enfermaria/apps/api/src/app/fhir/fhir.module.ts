import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { FhirController } from './fhir.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitorizacaoModule } from '../monitorizacao/monitorizacao.module';

@Module({
  imports: [PrismaModule, MonitorizacaoModule],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
