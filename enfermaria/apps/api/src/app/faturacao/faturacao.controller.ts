import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FaturacaoService } from './faturacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrativo')
@Controller('faturacao')
export class FaturacaoController {
  constructor(private readonly faturacaoService: FaturacaoService) {}

  @Get('resumo')
  @Roles('administrativo', 'direcao')
  resumo(@Query('inicio') inicio?: string, @Query('fim') fim?: string) {
    return this.faturacaoService.resumo(inicio, fim);
  }

  @Get()
  listar(
    @Query('estado') estado?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.faturacaoService.listar(estado, page ? +page : 1, limit ? +limit : 25);
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.faturacaoService.listarPorDoente(doenteId);
  }

  @Post()
  criar(@Body() body: { doenteId: string; tipoCobertura?: string; notas?: string }, @Request() req: any) {
    return this.faturacaoService.criar({ ...body, criadoPorId: req.user.sub });
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.faturacaoService.buscarPorId(id);
  }

  @Post(':id/itens')
  adicionarItem(
    @Param('id') id: string,
    @Body() body: { descricao: string; categoria: string; quantidade?: number; precoUnitario: number },
  ) {
    return this.faturacaoService.adicionarItem(id, body);
  }

  @Delete(':id/itens/:itemId')
  removerItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.faturacaoService.removerItem(id, itemId);
  }

  @Post(':id/pagamento')
  registarPagamento(
    @Param('id') id: string,
    @Body() body: { valor: number; metodo: string; referencia?: string },
    @Request() req: any,
  ) {
    return this.faturacaoService.registarPagamento(id, { ...body, registadoPorId: req.user.sub });
  }

  @Patch(':id/estado')
  mudarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.faturacaoService.mudarEstado(id, estado);
  }
}
