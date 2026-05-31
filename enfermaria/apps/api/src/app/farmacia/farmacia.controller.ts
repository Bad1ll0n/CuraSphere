import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FarmaciaService } from './farmacia.service';
import { CriarStockItemDto } from './dto/criar-stock-item.dto';
import { CriarPedidoFarmaciaDto } from './dto/criar-pedido-farmacia.dto';
import { AtualizarQuantidadeDto } from './dto/atualizar-quantidade.dto';
import { RejeitarPedidoDto } from './dto/rejeitar-pedido.dto';
import { CriarTransferenciaDto } from './dto/criar-transferencia.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('farmacia')
export class FarmaciaController {
  constructor(private readonly service: FarmaciaService) {}

  @Get('stock')
  listarStock(@Query('servico') servico?: string) {
    return this.service.listarStock(servico);
  }

  @Roles('farmaceutico', 'administrativo')
  @Post('stock')
  criarStockItem(@Body() dto: CriarStockItemDto) {
    return this.service.criarStockItem(dto);
  }

  @Roles('farmaceutico')
  @Patch('stock/:id')
  atualizarQuantidade(
    @Param('id') id: string,
    @Body() dto: AtualizarQuantidadeDto,
    @Request() req: any,
  ) {
    return this.service.atualizarQuantidade(id, dto.quantidade, dto.motivo, dto.tipo, req.user.sub);
  }

  @Roles('farmaceutico', 'administrativo', 'enfermeiro', 'medico')
  @Get('stock/:id/historico')
  historicoAjustes(@Param('id') id: string) {
    return this.service.historicoAjustes(id);
  }

  @Post('pedido')
  criarPedido(@Body() dto: CriarPedidoFarmaciaDto, @Request() req: any) {
    return this.service.criarPedido(dto, req.user.sub);
  }

  @Get('pedidos')
  listarPedidos(@Query('servico') servico?: string, @Request() req?: any) {
    const s = req?.user?.servico === 'farmacia' ? undefined : servico ?? req?.user?.servico;
    return this.service.listarPedidos(s);
  }

  @Roles('medico', 'direcao')
  @Get('pedidos/pendentes-aprovacao')
  pedidosPendentesAprovacao(@Query('servico') servico?: string) {
    return this.service.pedidosPendentesAprovacao(servico);
  }

  @Roles('medico', 'direcao')
  @Patch('pedido/:id/aprovar')
  aprovarPedido(@Param('id') id: string, @Request() req: any) {
    return this.service.aprovarPedido(id, req.user.sub);
  }

  @Roles('medico', 'direcao')
  @Patch('pedido/:id/rejeitar')
  rejeitarPedido(
    @Param('id') id: string,
    @Body() dto: RejeitarPedidoDto,
    @Request() req: any,
  ) {
    return this.service.rejeitarPedido(id, req.user.sub, dto.motivoRejeicao);
  }

  @Roles('farmaceutico')
  @Patch('pedido/:id/dispensar')
  dispensar(@Param('id') id: string, @Request() req: any) {
    return this.service.dispensar(id, req.user.sub);
  }

  @Roles('farmaceutico', 'administrativo', 'enfermeiro', 'medico')
  @Get('alertas')
  alertas() {
    return this.service.alertas();
  }

  // ── Transferências ──────────────────────────────────────────────────────────

  @Post('stock/:id/transferir')
  criarTransferencia(
    @Param('id') id: string,
    @Body() dto: CriarTransferenciaDto,
    @Request() req: any,
  ) {
    return this.service.criarTransferencia(id, dto.servicoDestino, dto.quantidade, dto.motivo, req.user.sub);
  }

  @Roles('farmaceutico', 'administrativo')
  @Get('transferencias')
  listarTransferencias(@Query('servico') servico?: string) {
    return this.service.listarTransferencias(servico);
  }

  @Roles('farmaceutico')
  @Patch('transferencias/:id/confirmar')
  confirmarTransferencia(@Param('id') id: string, @Request() req: any) {
    return this.service.confirmarTransferencia(id, req.user.sub);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch('transferencias/:id/cancelar')
  cancelarTransferencia(@Param('id') id: string) {
    return this.service.cancelarTransferencia(id);
  }

  // ── Relatório de gastos ────────────────────────────────────────────────────

  @Roles('farmaceutico', 'administrativo', 'direcao')
  @Get('relatorio-gastos')
  relatorioGastos(
    @Query('servico') servico?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.relatorioGastos(servico, dataInicio, dataFim);
  }
}
