import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { EscalasClinicasService } from './escalas-clinicas.service';
import { DoenteService } from '../doentes/doentes.service';
import { CriarEscalaClinicaDto } from './dto/criar-escala-clinica.dto';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('escalas-clinicas')
export class EscalasClinicasController {
  constructor(
    private readonly service: EscalasClinicasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Post(':doenteId')
  async registar(@Param('doenteId') doenteId: string, @Body() dto: CriarEscalaClinicaDto, @Request() req: PedidoAutenticado) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.registar(doenteId, dto, req.user.sub);
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado, @Query('tipo') tipo?: string) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId, tipo);
  }

  @Get(':doenteId/recentes')
  async listarRecentes(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarRecentes(doenteId);
  }
}
