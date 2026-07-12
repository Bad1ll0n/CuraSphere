import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RegrasCliniciasController } from './regras-clinicas.controller';
import { RegrasCliniciasService } from './regras-clinicas.service';

@Module({
  imports: [PrismaModule],
  controllers: [RegrasCliniciasController],
  providers: [RegrasCliniciasService],
})
export class RegrasCliniciasModule {}
