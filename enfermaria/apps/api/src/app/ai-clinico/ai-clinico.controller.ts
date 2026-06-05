import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiClinicoService, EpisodioTriagem, DoenteTurno } from './ai-clinico.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-clinico')
export class AiClinicoController {
  constructor(private readonly service: AiClinicoService) {}

  @Post('triagem')
  @Roles('medico', 'enfermeiro')
  analisarTriagem(@Body() episodio: EpisodioTriagem, @Request() req: any) {
    return this.service.analisarTriagem(episodio, req.user.id);
  }

  @Post('sumarizar-turno')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros')
  sumarizarTurno(@Body() body: { doentes: DoenteTurno[] }, @Request() req: any) {
    return this.service.sumarizarTurno(body.doentes, req.user.id);
  }

  @Post('sumarizar-turno-servico')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros')
  sumarizarTurnoServico(@Body() body: { servico: string }, @Request() req: any) {
    return this.service.sumarizarTurnoServico(body.servico, req.user.id);
  }

  // Relatório de auditoria IA (antes de /:doenteId para evitar conflito de rota)
  @Get('relatorio-auditoria')
  @Roles('direcao', 'it_admin', 'chefe_enfermeiros')
  async relatorioAuditoria(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tipo') tipo: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.relatorioAuditoria(from, to, tipo);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-ia.csv"');
    res.send(csv);
  }

  @Get(':doenteId/protocolo')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  verificarProtocolos(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.verificarProtocolos(doenteId, req.user.id);
  }

  @Get(':doenteId/los')
  @Roles('medico', 'chefe_enfermeiros', 'chefe_turno')
  preverLOS(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.preverLOS(doenteId, req.user.id);
  }

  @Patch('decisao/:id/feedback')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'farmaceutico')
  registarFeedback(
    @Param('id') id: string,
    @Body() body: { aceite: boolean; overrideMotivo?: string },
  ) {
    return this.service.registarFeedback(id, body.aceite, body.overrideMotivo);
  }

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno')
  analisar(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.analisar(doenteId, req.user.role, req.user.id);
  }
}
