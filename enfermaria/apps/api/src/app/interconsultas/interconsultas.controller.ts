import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InterconsultasService } from './interconsultas.service';
import { DoenteService } from '../doentes/doentes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarInterconsultaDto } from './dto/criar-interconsulta.dto';
import { ResponderInterconsultaDto } from './dto/responder-interconsulta.dto';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interconsultas')
export class InterconsultasController {
  constructor(
    private readonly interconsultasService: InterconsultasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Roles('medico', 'enfermeiro')
  @Post('doente/:doenteId')
  criar(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarInterconsultaDto,
    @Request() req: PedidoAutenticado,
  ) {
    return this.interconsultasService.criar(doenteId, req.user.sub, dto);
  }

  @Get('doente/:doenteId')
  async listarPorDoente(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.interconsultasService.listarPorDoente(doenteId);
  }

  @Get('pendentes')
  listarPendentes(@Query('especialidade') especialidade: string) {
    return this.interconsultasService.listarPendentes(especialidade);
  }

  @Get('minhas')
  listarMinhas(@Request() req: PedidoAutenticado) {
    return this.interconsultasService.listarMinhas(req.user.sub);
  }

  @Roles('medico')
  @Patch(':id/aceitar')
  aceitar(@Param('id') id: string, @Request() req: PedidoAutenticado) {
    return this.interconsultasService.aceitar(id, req.user.sub);
  }

  @Roles('medico')
  @Patch(':id/responder')
  responder(
    @Param('id') id: string,
    @Body() dto: ResponderInterconsultaDto,
    @Request() req: PedidoAutenticado,
  ) {
    return this.interconsultasService.responder(id, req.user.sub, dto.resposta);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Request() req: PedidoAutenticado) {
    return this.interconsultasService.cancelar(id, req.user.sub);
  }
}
