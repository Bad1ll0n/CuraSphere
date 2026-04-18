import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DispositivosInvasivosController } from './dispositivos-invasivos.controller';
import { DispositivosInvasivosService } from './dispositivos-invasivos.service';

@Module({
  imports: [PrismaModule],
  controllers: [DispositivosInvasivosController],
  providers: [DispositivosInvasivosService],
})
export class DispositivosInvasivosModule {}
