import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExamesService } from './exames.service';
import { DoenteService } from '../doentes/doentes.service';
import { SolicitarExameDto } from './dto/solicitar-exame.dto';
import { RegistarResultadoDto } from './dto/registar-resultado.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exames')
export class ExamesController {
  constructor(
    private readonly service: ExamesService,
    private readonly doenteService: DoenteService,
  ) {}

  @Post(':doenteId')
  @Roles('medico', 'enfermeiro')
  solicitar(@Param('doenteId') doenteId: string, @Body() dto: SolicitarExameDto, @Request() req: any) {
    return this.service.solicitar(doenteId, dto, req.user.sub);
  }

  @Get('worklist')
  @Roles('tecnico_saude', 'farmaceutico', 'medico', 'enfermeiro')
  worklist(@Query('tipo') tipo?: string, @Query('estado') estado?: string) {
    return this.service.worklist(tipo, estado);
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId);
  }

  @Patch(':id/estado')
  @Roles('tecnico_saude', 'medico', 'enfermeiro')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch(':id/resultado')
  @Roles('medico', 'farmaceutico', 'administrativo', 'enfermeiro', 'tecnico_saude')
  registarResultado(@Param('id') id: string, @Body() dto: RegistarResultadoDto, @Request() req: any) {
    return this.service.registarResultado(id, { ...dto, dataResultado: dto.dataResultado ? new Date(dto.dataResultado) : undefined }, req.user.sub);
  }

  @Patch(':id/cancelar')
  @Roles('medico', 'administrativo')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}
