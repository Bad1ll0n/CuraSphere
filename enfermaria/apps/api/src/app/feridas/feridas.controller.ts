import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { FeridasService } from './feridas.service';
import { CriarAvaliacaoFerida } from './dto/criar-avaliacao-ferida.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feridas')
export class FeridasController {
  constructor(
    private readonly service: FeridasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Post(':doenteId')
  async criar(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarAvaliacaoFerida,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.criar(doenteId, dto, req.user.sub, req.user.role);
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/ultima')
  async buscarUltima(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.buscarUltima(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Delete(':id')
  apagar(@Param('id') id: string, @Request() req: any) {
    return this.service.apagar(id, req.user.sub, req.user.role);
  }
}
