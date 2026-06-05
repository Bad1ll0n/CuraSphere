import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { BalancoHidricoService } from './balanco-hidrico.service';
import { RegistarBalancoDto } from './dto/registar-balanco.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('balanco-hidrico')
export class BalancoHidricoController {
  constructor(
    private readonly service: BalancoHidricoService,
    private readonly doenteService: DoenteService,
  ) {}

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Post(':doenteId')
  async registar(
    @Param('doenteId') doenteId: string,
    @Body() dto: RegistarBalancoDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.registar(doenteId, dto, req.user.sub, req.user.role);
  }

  @Get(':doenteId')
  async listar(
    @Param('doenteId') doenteId: string,
    @Query('data') data: string,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId, data);
  }

  @Get(':doenteId/historico')
  async historico(
    @Param('doenteId') doenteId: string,
    @Query('dias') dias: string,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.historico(doenteId, dias ? parseInt(dias, 10) : 7);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros')
  @Delete(':id')
  apagar(@Param('id') id: string, @Request() req: any) {
    return this.service.apagar(id, req.user.sub, req.user.role);
  }
}
