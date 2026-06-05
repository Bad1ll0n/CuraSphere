import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UrgenciaService } from './urgencia.service';
import { RegistarEntradaUrgenciaDto } from './dto/registar-entrada-urgencia.dto';
import { PreNotificacaoDto } from './dto/pre-notificacao.dto';
import { CompletarPreNotificacaoDto } from './dto/completar-pre-notificacao.dto';
import { ReTriagemDto } from './dto/re-triagem.dto';
import { AdicionarAtualizacaoDto } from './dto/adicionar-atualizacao.dto';
import { ActivarEspecialidadeDto } from './dto/activar-especialidade.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('urgencia')
export class UrgenciaController {
  constructor(private readonly service: UrgenciaService) {}

  @Post('episodio')
  @Roles('enfermeiro')
  registarEntrada(@Body() dto: RegistarEntradaUrgenciaDto, @Request() req: any) {
    return this.service.registarEntrada(dto, req.user.sub);
  }

  @Post('pre-notificacao')
  @Roles('enfermeiro', 'administrativo', 'medico')
  preNotificar(@Body() dto: PreNotificacaoDto, @Request() req: any) {
    return this.service.preNotificar(dto, req.user.sub);
  }

  @Patch(':id/completar-pre-notificacao')
  @Roles('enfermeiro', 'administrativo', 'medico')
  completarPreNotificacao(@Param('id') id: string, @Body() dto: CompletarPreNotificacaoDto) {
    return this.service.completarPreNotificacao(id, dto);
  }

  @Patch(':id/re-triagem')
  @Roles('enfermeiro', 'medico')
  reTriar(@Param('id') id: string, @Body() dto: ReTriagemDto, @Request() req: any) {
    return this.service.reTriar(id, dto, req.user.sub);
  }

  @Post(':id/atualizacao')
  @Roles('enfermeiro', 'medico', 'administrativo')
  adicionarAtualizacao(@Param('id') id: string, @Body() dto: AdicionarAtualizacaoDto, @Request() req: any) {
    return this.service.adicionarAtualizacao(id, dto, req.user.sub);
  }

  @Post(':id/activar-especialidade')
  @Roles('medico', 'enfermeiro')
  activarEspecialidade(@Param('id') id: string, @Body() dto: ActivarEspecialidadeDto, @Request() req: any) {
    return this.service.activarEspecialidade(id, dto, req.user.sub);
  }

  @Get('lista')
  listaEspera() {
    return this.service.listaEspera();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Sse('eventos')
  eventos(): Observable<MessageEvent> {
    return this.service.eventStream().pipe(
      map(e => ({ type: e.type, data: e.data }) as MessageEvent),
    );
  }

  @Patch(':id/estado')
  @Roles('enfermeiro', 'medico', 'administrativo')
  atualizarEstado(@Param('id') id: string, @Body('estado') estado: string) {
    return this.service.atualizarEstado(id, estado);
  }

  @Patch(':id/atribuir-medico')
  @Roles('medico', 'administrativo')
  atribuirMedico(
    @Param('id') id: string,
    @Body('medicoResponsavelId') medicoId: string,
    @Body('salaAtendimento') salaAtendimento?: string,
  ) {
    return this.service.atribuirMedico(id, medicoId, salaAtendimento);
  }
}
