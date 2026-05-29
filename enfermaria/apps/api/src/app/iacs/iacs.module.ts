import { Module } from '@nestjs/common';
import { IacsController } from './iacs.controller';
import { IacsService } from './iacs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IacsController],
  providers: [IacsService],
})
export class IacsModule {}
