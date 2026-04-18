import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BlocoService } from './bloco.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bloco')
export class BlocoController {
  constructor(private readonly service: BlocoService) {}

  @Post('cirurgia')
  @Roles('cirurgiao', 'chefe_turno', 'administrativo', 'chefe_medicos')
  agendar(@Body() dto: any, @Request() req: any) {
    return this.service.agendar({ cirurgiaoId: req.user.sub, ...dto });
  }

  @Get('agenda')
  agenda(@Query('data') data?: string, @Query('sala') sala?: string) {
    return this.service.agenda(data, sala);
  }

  @Get('cirurgia/:id')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Patch('cirurgia/:id/estado')
  @Roles('cirurgiao', 'anestesista', 'instrumentista', 'enfermeiro', 'chefe_turno', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch('cirurgia/:id/notas-pos')
  @Roles('cirurgiao', 'chefe_medicos')
  registarNotasPos(@Param('id') id: string, @Body() dto: any) {
    return this.service.registarNotasPos(id, dto);
  }

  @Get('cirurgia/:id/checklist')
  obterChecklist(@Param('id') id: string) {
    return this.service.obterChecklist(id);
  }

  @Post('cirurgia/:id/checklist/sign-in')
  @Roles('cirurgiao', 'anestesista', 'enfermeiro', 'enf_bloco', 'instrumentista')
  signIn(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.completarFase(id, 'signIn', req.user.sub, dto);
  }

  @Post('cirurgia/:id/checklist/time-out')
  @Roles('cirurgiao', 'anestesista', 'enfermeiro', 'enf_bloco', 'instrumentista')
  timeOut(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.completarFase(id, 'timeOut', req.user.sub, dto);
  }

  @Post('cirurgia/:id/checklist/sign-out')
  @Roles('cirurgiao', 'anestesista', 'enfermeiro', 'enf_bloco', 'instrumentista')
  signOut(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.completarFase(id, 'signOut', req.user.sub, dto);
  }
}
