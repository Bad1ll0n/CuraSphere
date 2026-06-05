import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FhirModule } from '../fhir/fhir.module';
import { DocumentosSaudeController } from './documentos-saude.controller';
import { DocumentosSaudeService } from './documentos-saude.service';

@Module({
  imports: [PrismaModule, FhirModule],
  controllers: [DocumentosSaudeController],
  providers: [DocumentosSaudeService],
  exports: [DocumentosSaudeService],
})
export class DocumentosSaudeModule {}
