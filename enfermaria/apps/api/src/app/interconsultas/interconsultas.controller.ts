import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InterconsultasService } from './interconsultas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('interconsultas')
export class InterconsultasController {
  constructor(private readonly interconsultasService: InterconsultasService) {}

  @Post('doente/:doenteId')
  criar(
    @Param('doenteId') doenteId: string,
    @Body() body: { especialidadeAlvo: string; motivo: string; urgente?: boolean },
    @Request() req: any,
  ) {
    return this.interconsultasService.criar(doenteId, req.user.sub, body);
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.interconsultasService.listarPorDoente(doenteId);
  }

  @Get('pendentes')
  listarPendentes(@Query('especialidade') especialidade: string) {
    return this.interconsultasService.listarPendentes(especialidade);
  }

  @Get('minhas')
  listarMinhas(@Request() req: any) {
    return this.interconsultasService.listarMinhas(req.user.sub);
  }

  @Patch(':id/aceitar')
  aceitar(@Param('id') id: string, @Request() req: any) {
    return this.interconsultasService.aceitar(id, req.user.sub);
  }

  @Patch(':id/responder')
  responder(
    @Param('id') id: string,
    @Body() body: { resposta: string },
    @Request() req: any,
  ) {
    return this.interconsultasService.responder(id, req.user.sub, body.resposta);
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Request() req: any) {
    return this.interconsultasService.cancelar(id, req.user.sub);
  }
}
