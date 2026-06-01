import { Module } from '@nestjs/common';
import { ExamesController } from './exames.controller';
import { ExamesService } from './exames.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [PrismaModule, DoenteModule],
  controllers: [ExamesController],
  providers: [ExamesService],
})
export class ExamesModule {}
