import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExamesService } from './exames.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exames')
export class ExamesController {
  constructor(private readonly service: ExamesService) {}

  @Post(':doenteId')
  @Roles('medico', 'enfermeiro')
  solicitar(@Param('doenteId') doenteId: string, @Body() dto: any, @Request() req: any) {
    return this.service.solicitar(doenteId, dto, req.user.sub);
  }

  @Get('worklist')
  @Roles('tecnico_saude', 'farmaceutico', 'medico', 'enfermeiro')
  worklist(@Query('tipo') tipo?: string) {
    return this.service.worklist(tipo);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Patch(':id/estado')
  @Roles('tecnico_saude', 'medico', 'enfermeiro')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch(':id/resultado')
  @Roles('medico', 'farmaceutico', 'administrativo', 'enfermeiro', 'tecnico_saude')
  registarResultado(@Param('id') id: string, @Body() dto: any) {
    return this.service.registarResultado(id, dto);
  }

  @Patch(':id/cancelar')
  @Roles('medico', 'administrativo')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}
