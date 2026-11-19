import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';
import { Hl7Service } from './hl7.service';
import { Hl7Controller } from './hl7.controller';
import { Hl7SaidaModule } from './hl7-saida.module';

@Module({
  imports: [PrismaModule, AlertasModule, Hl7SaidaModule],
  controllers: [Hl7Controller],
  providers: [Hl7Service],
  exports: [Hl7Service, Hl7SaidaModule],
})
export class Hl7Module {}
