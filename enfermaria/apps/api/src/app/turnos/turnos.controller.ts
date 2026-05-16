import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TurnosService } from './turnos.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TipoTurno } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('turnos')
export class TurnosController {
  constructor(
    private readonly turnosService: TurnosService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('ativo')
  turnoAtivo() {
    return this.turnosService.turnoAtivo();
  }

  @Get('passagem-turno')
  passagemTurno(@Request() req: any) {
    return this.turnosService.passagemTurno(req.user.sub);
  }

  @Post('check-in')
  checkIn(@Request() req: any) {
    return this.turnosService.checkIn(req.user.sub);
  }

  @Post('confirmar-passagem')
  confirmarPassagem(@Request() req: any) {
    return this.turnosService.confirmarPassagemTurno(req.user.sub);
  }

  @Roles('enfermeiro')
  @Post(':id/atribuir-doentes')
  atribuirDoentes(
    @Param('id') turnoId: string,
    @Body() body: { atribuicoes: { doenteId: string; enfermeiroId: string }[] },
  ) {
    return this.turnosService.atribuirDoentes(turnoId, body.atribuicoes);
  }

  @Post('nota')
  adicionarNota(
    @Body() body: { turnoId: string; doenteId: string; texto: string },
    @Request() req: any,
  ) {
    return this.turnosService.adicionarNota({ ...body, autorId: req.user.sub });
  }

  @Roles('enfermeiro', 'administrativo')
  @Post()
  criar(@Body() body: {
    tipo: TipoTurno;
    dataInicio: Date;
    dataFim: Date;
    chefeTurnoId: string;
  }) {
    return this.turnosService.criar(body);
  }

  @Get(':id/relatorio/pdf')
  async pdfRelatorio(@Param('id') turnoId: string, @Res() res: Response) {
    const buffer = await this.pdfService.gerarRelatorioTurno(turnoId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="turno-${turnoId}.pdf"` });
    res.send(buffer);
  }
}
