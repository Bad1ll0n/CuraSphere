import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UrgenciaService } from './urgencia.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('urgencia')
export class UrgenciaController {
  constructor(private readonly service: UrgenciaService) {}

  @Post('episodio')
  @Roles('triador', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno')
  registarEntrada(@Body() dto: any, @Request() req: any) {
    return this.service.registarEntrada(dto, req.user.sub);
  }

  @Get('lista')
  listaEspera() {
    return this.service.listaEspera();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Patch(':id/estado')
  @Roles('triador', 'enfermeiro', 'medico', 'chefe_enfermeiros', 'chefe_medicos', 'chefe_turno', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch(':id/atribuir-medico')
  @Roles('medico', 'chefe_medicos', 'chefe_turno', 'administrativo')
  atribuirMedico(@Param('id') id: string, @Body('medicoResponsavelId') medicoId: string) {
    return this.service.atribuirMedico(id, medicoId);
  }
}
