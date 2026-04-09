import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AtribuicoesService } from './atribuicoes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('atribuicoes')
export class AtribuicoesController {
  constructor(private readonly service: AtribuicoesService) {}

  // Turnos do dia (com atribuições)
  @Get('turnos')
  turnosDoDia(@Query('data') data?: string) {
    return this.service.turnosDoDia(data);
  }

  // Turno ativo agora
  @Get('turno-ativo')
  turnoAtivo() {
    return this.service.turnoAtivo();
  }

  // Turno por id
  @Get('turno/:turnoId')
  buscarTurno(@Param('turnoId') turnoId: string) {
    return this.service.buscarTurno(turnoId);
  }

  // Atribuir doente a profissional
  @Post('turno/:turnoId')
  atribuir(
    @Param('turnoId') turnoId: string,
    @Body() body: { doenteId: string; utilizadorId: string },
    @Request() req: any,
  ) {
    return this.service.atribuir(turnoId, body.doenteId, body.utilizadorId, req.user.sub);
  }

  // Remover atribuição
  @Delete('turno/:turnoId')
  remover(
    @Param('turnoId') turnoId: string,
    @Body() body: { doenteId: string; utilizadorId: string },
    @Request() req: any,
  ) {
    return this.service.remover(turnoId, body.doenteId, body.utilizadorId, req.user.sub);
  }
}
