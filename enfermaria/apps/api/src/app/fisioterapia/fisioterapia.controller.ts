import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FisioterapiaService } from './fisioterapia.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fisioterapia')
export class FisioterapiaController {
  constructor(private readonly service: FisioterapiaService) {}

  @Post('plano/:doenteId')
  @Roles('tecnico_saude')
  criarPlano(@Param('doenteId') doenteId: string, @Body() dto: any, @Request() req: any) {
    return this.service.criarPlano(doenteId, dto, req.user.sub);
  }

  @Get('plano/:doenteId')
  planoPorDoente(@Param('doenteId') doenteId: string) {
    return this.service.planoPorDoente(doenteId);
  }

  @Post('sessao')
  @Roles('tecnico_saude')
  agendarSessao(@Body() dto: any, @Request() req: any) {
    return this.service.agendarSessao(dto, req.user.sub);
  }

  @Patch('sessao/:id/realizar')
  @Roles('tecnico_saude')
  realizarSessao(@Param('id') id: string, @Body() dto: any) {
    return this.service.realizarSessao(id, dto);
  }

  @Get('agenda')
  agendaFisioterapeuta(@Request() req: any) {
    return this.service.agendaFisioterapeuta(req.user.sub);
  }
}
