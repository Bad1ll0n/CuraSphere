import { Module } from '@nestjs/common';
import { PedidosInternosController } from './pedidos-internos.controller';
import { PedidosInternosService } from './pedidos-internos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PedidosInternosController],
  providers: [PedidosInternosService],
})
export class PedidosInternosModule {}
