import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FaturacaoService } from './faturacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarFaturacaoDto } from './dto/criar-faturacao.dto';
import { CriarItemFaturaDto } from './dto/criar-item-fatura.dto';
import { RegistarPagamentoDto } from './dto/registar-pagamento.dto';

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
    const pageNum = Math.max(1, page ? parseInt(page, 10) || 1 : 1);
    const limitNum = Math.min(100, Math.max(1, limit ? parseInt(limit, 10) || 25 : 25));
    return this.faturacaoService.listar(estado, pageNum, limitNum);
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.faturacaoService.listarPorDoente(doenteId);
  }

  @Post()
  criar(@Body() dto: CriarFaturacaoDto, @Request() req: any) {
    return this.faturacaoService.criar({ ...dto, criadoPorId: req.user.sub });
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.faturacaoService.buscarPorId(id);
  }

  @Post(':id/itens')
  adicionarItem(
    @Param('id') id: string,
    @Body() dto: CriarItemFaturaDto,
  ) {
    return this.faturacaoService.adicionarItem(id, dto);
  }

  @Delete(':id/itens/:itemId')
  removerItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.faturacaoService.removerItem(id, itemId);
  }

  @Post(':id/pagamento')
  registarPagamento(
    @Param('id') id: string,
    @Body() dto: RegistarPagamentoDto,
    @Request() req: any,
  ) {
    return this.faturacaoService.registarPagamento(id, { ...dto, registadoPorId: req.user.sub });
  }

  @Patch(':id/estado')
  mudarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.faturacaoService.mudarEstado(id, estado);
  }
}
