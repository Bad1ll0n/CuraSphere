import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BlocoService } from './bloco.service';
import { AgendarCirurgiaDto } from './dto/agendar-cirurgia.dto';
import { RegistarNotasPosDto } from './dto/registar-notas-pos.dto';
import { ChecklistBlocoDto } from './dto/checklist-bloco.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bloco')
export class BlocoController {
  constructor(private readonly service: BlocoService) {}

  @Post('cirurgia')
  @Roles('medico', 'enfermeiro', 'administrativo')
  agendar(@Body() dto: AgendarCirurgiaDto, @Request() req: any) {
    return this.service.agendar({ cirurgiaoId: req.user.sub, ...dto });
  }

  @Get('salas/status')
  salaStatus() {
    return this.service.salaStatus();
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
  @Roles('medico', 'enfermeiro', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch('cirurgia/:id/notas-pos')
  @Roles('medico')
  registarNotasPos(@Param('id') id: string, @Body() dto: RegistarNotasPosDto, @Request() req: any) {
    return this.service.registarNotasPos(id, dto, req.user.sub);
  }

  @Get('cirurgia/:id/checklist')
  obterChecklist(@Param('id') id: string) {
    return this.service.obterChecklist(id);
  }

  @Post('cirurgia/:id/checklist/sign-in')
  @Roles('medico', 'enfermeiro')
  signIn(@Param('id') id: string, @Body() dto: ChecklistBlocoDto, @Request() req: any) {
    return this.service.completarFase(id, 'signIn', req.user.sub, dto);
  }

  @Post('cirurgia/:id/checklist/time-out')
  @Roles('medico', 'enfermeiro')
  timeOut(@Param('id') id: string, @Body() dto: ChecklistBlocoDto, @Request() req: any) {
    return this.service.completarFase(id, 'timeOut', req.user.sub, dto);
  }

  @Post('cirurgia/:id/checklist/sign-out')
  @Roles('medico', 'enfermeiro')
  signOut(@Param('id') id: string, @Body() dto: ChecklistBlocoDto, @Request() req: any) {
    return this.service.completarFase(id, 'signOut', req.user.sub, dto);
  }
}
