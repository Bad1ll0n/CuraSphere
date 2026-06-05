import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RelatorioPassagemTurnoService, GerarRelatorioDto, ConfirmarRelatorioDto } from './relatorio-passagem-turno.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('relatorio-passagem-turno')
export class RelatorioPassagemTurnoController {
  constructor(private readonly service: RelatorioPassagemTurnoService) {}

  @Post('gerar')
  @Roles('enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'medico')
  gerar(@Body() dto: GerarRelatorioDto, @Request() req: any) {
    return this.service.gerarRascunho(dto, req.user.sub);
  }

  @Post(':id/confirmar')
  @Roles('enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'medico')
  confirmar(@Param('id') id: string, @Body() dto: ConfirmarRelatorioDto, @Request() req: any) {
    return this.service.confirmar(id, dto, req.user.sub);
  }

  @Get('historico')
  @Roles('enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'medico', 'direcao')
  historico(@Query('servico') servico: string) {
    return this.service.historico(servico);
  }
}
