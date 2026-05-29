import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PedidosInternosService } from './pedidos-internos.service';
import { CriarPedidoInternoDto } from './dto/criar-pedido-interno.dto';

@UseGuards(JwtAuthGuard)
@Controller('pedidos-internos')
export class PedidosInternosController {
  constructor(private readonly service: PedidosInternosService) {}

  @Post()
  criar(@Body() dto: CriarPedidoInternoDto, @Request() req: any) {
    return this.service.criar({ ...dto, servicoOrigem: dto.servicoOrigem ?? req.user.servico }, req.user.sub);
  }

  @Get()
  listar(@Query('servico') servico?: string, @Request() req?: any) {
    return this.service.listar(servico ?? req?.user?.servico);
  }

  @Patch(':id/aceitar')
  aceitar(@Param('id') id: string, @Request() req: any) {
    return this.service.aceitar(id, req.user.sub);
  }

  @Patch(':id/concluir')
  concluir(@Param('id') id: string) {
    return this.service.concluir(id);
  }
}
