import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { Hl7Service } from './hl7.service';
import { Hl7Controller } from './hl7.controller';

@Module({
  imports: [PrismaModule],
  controllers: [Hl7Controller],
  providers: [Hl7Service],
  exports: [Hl7Service],
})
export class Hl7Module {}
