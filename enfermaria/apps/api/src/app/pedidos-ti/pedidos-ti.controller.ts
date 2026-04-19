import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { PedidosTIService } from './pedidos-ti.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { AtualizarPedidoDto } from './dto/atualizar-pedido.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedidos-ti')
export class PedidosTIController {
  constructor(private readonly service: PedidosTIService) {}

  @Post()
  criar(@Body() dto: CriarPedidoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.id);
  }

  @Get()
  listar(@Request() req: any) {
    return this.service.listar(req.user.id, req.user.role);
  }

  @Get(':id')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarPedidoDto, @Request() req: any) {
    return this.service.atualizar(id, dto, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.it_admin)
  eliminar(@Param('id') id: string, @Request() req: any) {
    return this.service.eliminar(id, req.user.role);
  }
}
