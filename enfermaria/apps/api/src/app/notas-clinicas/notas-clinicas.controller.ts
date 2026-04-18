import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotasClinicasService } from './notas-clinicas.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notas-clinicas')
export class NotasClinicasController {
  constructor(private readonly service: NotasClinicasService) {}

  @Post(':doenteId')
  @Roles('medico', 'medico_especialista', 'cirurgiao', 'anestesiologista',
         'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'enfermeiro_gestor',
         'chefe_enfermeiros')
  criar(@Param('doenteId') doenteId: string, @Body() dto: any, @Request() req: any) {
    return this.service.criar(doenteId, dto, req.user.sub);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Patch(':id')
  @Roles('medico', 'medico_especialista', 'cirurgiao', 'anestesiologista',
         'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'enfermeiro_gestor',
         'chefe_enfermeiros')
  atualizar(@Param('id') id: string, @Body() dto: any) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('medico', 'medico_especialista', 'chefe_medicos')
  apagar(@Param('id') id: string) {
    return this.service.apagar(id);
  }
}
