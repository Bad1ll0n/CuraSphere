import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { TransfusaoService } from './transfusao.service';
import { CriarPedidoTransfusaoDto } from './dto/criar-pedido-transfusao.dto';
import { AdicionarBolsaDto } from './dto/adicionar-bolsa.dto';
import { RegistarTransfusaoDto } from './dto/registar-transfusao.dto';
import { RegistarReacaoDto } from './dto/registar-reacao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transfusao')
export class TransfusaoController {
  constructor(
    private readonly service: TransfusaoService,
    private readonly doenteService: DoenteService,
  ) {}

  // ── Doente ─────────────────────────────────────────────────────────────────
  @Get('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'direcao')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarPorDoente(doenteId);
  }

  @Post('doente/:doenteId/pedido')
  @Roles('medico', 'chefe_enfermeiros')
  async criarPedido(@Param('doenteId') doenteId: string, @Body() dto: CriarPedidoTransfusaoDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.criarPedido(doenteId, dto, req.user.sub);
  }

  @Patch('pedido/:id/cancelar')
  @Roles('medico', 'chefe_enfermeiros')
  async cancelar(@Param('id') id: string, @Body('motivo') motivo: string, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPedido(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.cancelarPedido(id, motivo ?? 'Sem motivo indicado');
  }

  @Get('pedido/:id/compativeis')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico')
  async compativeis(@Param('id') id: string, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPedido(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.bolsasCompativeis(id);
  }

  @Patch('pedido/:id/reservar')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico')
  async reservar(@Param('id') id: string, @Body('bolsaId') bolsaId: string, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPedido(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.reservarBolsa(id, bolsaId);
  }

  @Post('pedido/:id/administrar')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async administrar(@Param('id') id: string, @Body() dto: RegistarTransfusaoDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPedido(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.administrar(id, dto, req.user.sub);
  }

  @Post('registo/:id/reacao')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async registarReacao(@Param('id') id: string, @Body() dto: RegistarReacaoDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoRegisto(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.registarReacao(id, dto, req.user.sub);
  }

  // ── Banco de sangue (stock, não é por-doente) ────────────────────────────────
  @Get('banco')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'ti', 'direcao')
  listarBanco(@Query('componente') componente?: string, @Query('grupoABO') grupoABO?: string, @Query('estado') estado?: string) {
    return this.service.listarBanco({ componente, grupoABO, estado });
  }

  @Post('banco')
  @Roles('farmaceutico', 'ti', 'chefe_enfermeiros')
  adicionarBolsa(@Body() dto: AdicionarBolsaDto) {
    return this.service.adicionarBolsa(dto);
  }
}
