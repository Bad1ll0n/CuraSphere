import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsultasService } from './consultas.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultas')
export class ConsultasController {
  constructor(private readonly service: ConsultasService) {}

  @Post()
  @Roles('secretaria', 'medico', 'chefe_medicos', 'administrativo')
  agendar(@Body() dto: any, @Request() req: any) {
    return this.service.agendar({ medicoId: req.user.sub, ...dto });
  }

  @Get()
  listar(@Query('medicoId') medicoId?: string, @Query('especialidade') especialidade?: string, @Query('data') data?: string) {
    return this.service.listar(medicoId, especialidade, data);
  }

  @Get('medico/:medicoId')
  agendaMedico(@Param('medicoId') medicoId: string) {
    return this.service.agendaMedico(medicoId);
  }

  @Patch(':id/realizar')
  @Roles('medico', 'chefe_medicos')
  realizar(@Param('id') id: string, @Body() dto: any) {
    return this.service.realizar(id, dto);
  }

  @Patch(':id/estado')
  @Roles('secretaria', 'medico', 'chefe_medicos', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }
}
