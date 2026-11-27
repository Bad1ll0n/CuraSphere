import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PedidosCamaService } from './pedidos-cama.service';
import { AtribuirCamaPedidoDto, CancelarPedidoCamaDto, CriarPedidoCamaDto, OcuparPedidoCamaDto } from './dto/pedido-cama.dto';

/** PROD-03 — pedidos de cama (urgência, bloco, consulta, outro serviço). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedidos-cama')
export class PedidosCamaController {
  constructor(private readonly service: PedidosCamaService) {}

  @Get()
  @Roles('medico', 'enfermeiro', 'administrativo', 'direcao')
  listar(@Query('estado') estado?: string, @Query('servico') servico?: string) {
    return this.service.listar(estado, servico);
  }

  @Get('indicadores')
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros', 'chefe_medicos', 'administrativo')
  indicadores(@Query('desde') desde?: string) {
    return this.service.indicadores(desde);
  }

  @Post()
  @Roles('medico', 'enfermeiro', 'administrativo')
  criar(@Body() dto: CriarPedidoCamaDto, @Request() req: any) {
    return this.service.criar(dto, req.user.sub);
  }

  /** Gestão de camas: reservar uma cama para o pedido. */
  @Patch(':id/atribuir')
  @Roles('enfermeiro', 'administrativo')
  atribuir(@Param('id') id: string, @Body() dto: AtribuirCamaPedidoDto, @Request() req: any) {
    return this.service.atribuir(id, dto, req.user.sub);
  }

  /** O doente chegou à cama: internado, episódio aberto. */
  @Post(':id/ocupar')
  @Roles('enfermeiro', 'administrativo')
  ocupar(@Param('id') id: string, @Body() dto: OcuparPedidoCamaDto, @Request() req: any) {
    return this.service.ocupar(id, dto, req.user.sub);
  }

  @Patch(':id/cancelar')
  @Roles('medico', 'enfermeiro', 'administrativo')
  cancelar(@Param('id') id: string, @Body() dto: CancelarPedidoCamaDto) {
    return this.service.cancelar(id, dto.motivo);
  }
}
