import { Module } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { DoenteController } from './doentes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [DoenteController],
  providers: [DoenteService, PdfService],
  exports: [DoenteService],
})
export class DoenteModule {}
