import { Module } from '@nestjs/common';
import { TrocasService } from './trocas.service';
import { TrocasController } from './trocas.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TrocasController],
  providers: [TrocasService],
})
export class TrocasModule {}
