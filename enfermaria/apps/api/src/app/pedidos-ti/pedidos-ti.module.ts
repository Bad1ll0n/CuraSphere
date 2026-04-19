import { Module } from '@nestjs/common';
import { PedidosTIController } from './pedidos-ti.controller';
import { PedidosTIService } from './pedidos-ti.service';

@Module({
  controllers: [PedidosTIController],
  providers: [PedidosTIService],
})
export class PedidosTIModule {}
