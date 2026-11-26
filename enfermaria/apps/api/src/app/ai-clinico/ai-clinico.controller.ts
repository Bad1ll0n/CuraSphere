import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, Res, Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiClinicoService } from './ai-clinico.service';
import { AiVigilanciaService } from './ai-vigilancia.service';
import { AiRelatoriosService } from './ai-relatorios.service';
import {
  EpisodioTriagemDto, SumarizarTurnoDto, SumarizarTurnoServicoDto,
  ExecutarNlqDto, FeedbackDecisaoDto,
} from './dto/ai-clinico.dto';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-clinico')
export class AiClinicoController {
  constructor(
    private readonly service: AiClinicoService,
    private readonly vigilancia: AiVigilanciaService,
    private readonly relatorios: AiRelatoriosService,
  ) {}

  @Post('triagem')
  @Roles('medico', 'enfermeiro')
  analisarTriagem(@Body() episodio: EpisodioTriagemDto, @Request() req: PedidoAutenticado) {
    return this.service.analisarTriagem(episodio, req.user.sub);
  }

  @Post('sumarizar-turno')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  sumarizarTurno(@Body() body: SumarizarTurnoDto, @Request() req: PedidoAutenticado) {
    return this.service.sumarizarTurno(body.doentes, req.user.sub);
  }

  @Post('sumarizar-turno-servico')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  sumarizarTurnoServico(@Body() body: SumarizarTurnoServicoDto, @Request() req: PedidoAutenticado) {
    return this.service.sumarizarTurnoServico(body.servico, req.user.sub);
  }

  @Post('nlq')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  executarNLQ(@Body() body: ExecutarNlqDto, @Request() req: PedidoAutenticado) {
    return this.service.executarNLQ(body.query, req.user.sub);
  }

  // Relatório de auditoria IA (antes de /:doenteId para evitar conflito de rota)
  @Get('relatorio-auditoria')
  @Roles('direcao', 'ti', 'chefe_enfermeiros')
  async relatorioAuditoria(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tipo') tipo: string,
    @Res() res: Response,
  ) {
    const csv = await this.relatorios.relatorioAuditoria(from, to, tipo);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-ia.csv"');
    res.send(csv);
  }

  @Get('insights')
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros')
  insightsRejeicao(@Query('from') from?: string, @Query('to') to?: string) {
    return this.relatorios.insightsRejeicao(from, to);
  }

  @Get('outcomes-correlation')
  @Roles('medico', 'direcao', 'qualidade', 'ti')
  correlacaoOutcomes(@Query('from') from?: string, @Query('to') to?: string) {
    return this.relatorios.correlacaoOutcomes(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('icd10/sugerir')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo')
  sugerirIcd10(@Body('nota') nota: string) {
    return this.service.sugerirIcd10(nota ?? '');
  }

  @Post(':doenteId/readmissao')
  @Roles('medico', 'chefe_enfermeiros', 'administrativo')
  calcularRiscoReadmissao(@Param('doenteId') doenteId: string) {
    return this.vigilancia.calcularRiscoReadmissao(doenteId);
  }

  @Get(':doenteId/protocolo')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  verificarProtocolos(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado) {
    return this.service.verificarProtocolos(doenteId, req.user.sub);
  }

  @Get(':doenteId/los')
  @Roles('medico', 'chefe_enfermeiros')
  preverLOS(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado) {
    return this.service.preverLOS(doenteId, req.user.sub);
  }

  @Patch('decisao/:id/feedback')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico')
  registarFeedback(
    @Param('id') id: string,
    @Body() body: FeedbackDecisaoDto,
  ) {
    return this.relatorios.registarFeedback(id, body.aceite, body.overrideMotivo);
  }

  @Sse(':doenteId/stream')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  analisarStream(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado): Observable<MessageEvent> {
    return this.service.analisarStream(doenteId, req.user.role, req.user.sub) as unknown as Observable<MessageEvent>;
  }

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  analisar(@Param('doenteId') doenteId: string, @Request() req: PedidoAutenticado) {
    return this.service.analisar(doenteId, req.user.role, req.user.sub);
  }

  @Post(':doenteId/diagnostico-diferencial')
  @Roles('medico', 'chefe_enfermeiros')
  diagnosticoDiferencial(
    @Param('doenteId') doenteId: string,
    @Body('sintomas') sintomas: string,
    @Request() req: PedidoAutenticado,
  ) {
    return this.service.diagnosticoDiferencial(doenteId, sintomas, req.user.sub);
  }

  @Post(':doenteId/carta-alta')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  async gerarCartaAlta(@Param('doenteId') doenteId: string) {
    await this.service.gerarCartaAlta(doenteId);
    return { ok: true };
  }
}
