import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FarmaciaService } from './farmacia.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('farmacia')
export class FarmaciaController {
  constructor(private readonly service: FarmaciaService) {}

  @Get('stock')
  listarStock(@Query('servico') servico?: string) {
    return this.service.listarStock(servico);
  }

  @Post('stock')
  @Roles('farmaceutico', 'tecnico_farmacia', 'administrativo')
  criarStockItem(@Body() dto: any) {
    return this.service.criarStockItem(dto);
  }

  @Patch('stock/:id')
  @Roles('farmaceutico', 'tecnico_farmacia')
  atualizarQuantidade(@Param('id') id: string, @Body('quantidade') quantidade: number) {
    return this.service.atualizarQuantidade(id, quantidade);
  }

  @Post('pedido')
  criarPedido(@Body() dto: any, @Request() req: any) {
    return this.service.criarPedido(dto, req.user.sub);
  }

  @Get('pedidos')
  listarPedidos(@Query('servico') servico?: string, @Request() req?: any) {
    const s = req?.user?.servico === 'farmacia' ? undefined : servico ?? req?.user?.servico;
    return this.service.listarPedidos(s);
  }

  @Patch('pedido/:id/dispensar')
  @Roles('farmaceutico', 'tecnico_farmacia')
  dispensar(@Param('id') id: string, @Request() req: any) {
    return this.service.dispensar(id, req.user.sub);
  }

  @Get('alertas')
  @Roles('farmaceutico', 'tecnico_farmacia', 'administrativo', 'chefe_enfermeiros', 'chefe_medicos')
  alertas() {
    return this.service.alertas();
  }
}
