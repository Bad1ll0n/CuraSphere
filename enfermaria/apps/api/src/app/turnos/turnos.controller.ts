import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TurnosService } from './turnos.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TipoTurno } from '../common/enums';
import { CheckInDto } from './dto/check-in.dto';
import { NotaTurnoDto } from './dto/nota-turno.dto';
import { CriarTurnoDto } from './dto/criar-turno.dto';

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
  checkIn(
    @Request() req: any,
    @Body() dto: CheckInDto = {},
  ) {
    const ip = req.headers['x-real-ip'] ?? req.ip ?? '';
    return this.turnosService.checkIn(req.user.sub, {
      lat: dto.lat,
      lon: dto.lon,
      ip,
    });
  }

  @Post('iniciar-passagem')
  iniciarPassagem(@Request() req: any) {
    return this.turnosService.iniciarPassagem(req.user.sub);
  }

  @Post('confirmar-passagem')
  confirmarPassagem(@Request() req: any) {
    return this.turnosService.confirmarPassagemTurno(req.user.sub);
  }

  @Roles('enfermeiro', 'direcao', 'ti')
  @Get('ativo/inatividade')
  inatividade() {
    return this.turnosService.inatividade();
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
    @Body() dto: NotaTurnoDto,
    @Request() req: any,
  ) {
    return this.turnosService.adicionarNota({ ...dto, autorId: req.user.sub });
  }

  @Roles('enfermeiro', 'administrativo')
  @Post()
  criar(@Body() dto: CriarTurnoDto) {
    return this.turnosService.criar({ ...dto, tipo: dto.tipo as TipoTurno });
  }

  @Get(':id/relatorio/pdf')
  async pdfRelatorio(@Param('id') turnoId: string, @Res() res: Response) {
    const buffer = await this.pdfService.gerarRelatorioTurno(turnoId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="turno-${turnoId}.pdf"` });
    res.send(buffer);
  }
}
