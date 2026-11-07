import { Module } from '@nestjs/common';
import { CamasService } from './camas.service';
import { CamasController } from './camas.controller';
import { PedidosCamaService } from './pedidos-cama.service';
import { PedidosCamaController } from './pedidos-cama.controller';

@Module({
  controllers: [CamasController, PedidosCamaController],
  providers: [CamasService, PedidosCamaService],
  exports: [CamasService, PedidosCamaService],
})
export class CamasModule {}
