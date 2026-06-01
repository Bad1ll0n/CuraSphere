import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DoenteModule } from '../doentes/doentes.module';
import { DispositivosInvasivosController } from './dispositivos-invasivos.controller';
import { DispositivosInvasivosService } from './dispositivos-invasivos.service';

@Module({
  imports: [PrismaModule, DoenteModule],
  controllers: [DispositivosInvasivosController],
  providers: [DispositivosInvasivosService],
})
export class DispositivosInvasivosModule {}
