import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsultasService } from './consultas.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultas')
export class ConsultasController {
  constructor(private readonly service: ConsultasService) {}

  // ─── Agenda semanal ───────────────────────────────────────────────────────

  @Post('agenda')
  @Roles('medico', 'administrativo', 'direcao')
  criarAgenda(@Body() dto: any) {
    return this.service.criarAgenda(dto);
  }

  @Patch('agenda/:id')
  @Roles('medico', 'administrativo', 'direcao')
  atualizarAgenda(@Param('id') id: string, @Body() dto: any) {
    return this.service.atualizarAgenda(id, dto);
  }

  @Delete('agenda/:id')
  @Roles('medico', 'administrativo', 'direcao')
  removerAgenda(@Param('id') id: string) {
    return this.service.removerAgenda(id);
  }

  @Get('agenda/:medicoId')
  agendaSemanal(@Param('medicoId') medicoId: string) {
    return this.service.agendaSemanal(medicoId);
  }

  // ─── Slots disponíveis ────────────────────────────────────────────────────

  @Get('slots')
  slots(@Query('medicoId') medicoId: string, @Query('data') data: string) {
    return this.service.calcularSlots(medicoId, data);
  }

  // ─── Marcações ───────────────────────────────────────────────────────────

  @Post()
  @Roles('medico', 'administrativo')
  agendar(@Body() dto: any) {
    return this.service.agendar(dto);
  }

  @Get()
  listar(
    @Query('medicoId') medicoId?: string,
    @Query('especialidade') especialidade?: string,
    @Query('data') data?: string,
  ) {
    return this.service.listar(medicoId, especialidade, data);
  }

  @Get('medico/:medicoId')
  agendaMedico(@Param('medicoId') medicoId: string) {
    return this.service.agendaMedico(medicoId);
  }

  @Post(':id/checkin')
  @Roles('medico', 'administrativo')
  checkin(@Param('id') id: string) {
    return this.service.checkin(id);
  }

  @Patch(':id/realizar')
  @Roles('medico')
  realizar(@Param('id') id: string, @Body() dto: any) {
    return this.service.realizar(id, dto);
  }

  @Patch(':id/estado')
  @Roles('medico', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }
}
