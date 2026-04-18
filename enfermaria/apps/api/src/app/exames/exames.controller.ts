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
  @Roles('medico', 'chefe_medicos', 'enfermeiro', 'chefe_enfermeiros')
  solicitar(@Param('doenteId') doenteId: string, @Body() dto: any, @Request() req: any) {
    return this.service.solicitar(doenteId, dto, req.user.sub);
  }

  @Get('worklist')
  @Roles('radiologista', 'patologista', 'tecnico', 'tecnico_farmacia', 'medico',
         'medico_especialista', 'chefe_medicos', 'enfermeiro', 'chefe_enfermeiros')
  worklist(@Query('tipo') tipo?: string) {
    return this.service.worklist(tipo);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Patch(':id/estado')
  @Roles('radiologista', 'patologista', 'tecnico', 'medico', 'medico_especialista', 'chefe_medicos', 'enfermeiro')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch(':id/resultado')
  @Roles('medico', 'chefe_medicos', 'tecnico_farmacia', 'administrativo', 'enfermeiro',
         'radiologista', 'patologista', 'tecnico')
  registarResultado(@Param('id') id: string, @Body() dto: any) {
    return this.service.registarResultado(id, dto);
  }

  @Patch(':id/cancelar')
  @Roles('medico', 'chefe_medicos', 'administrativo')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}
