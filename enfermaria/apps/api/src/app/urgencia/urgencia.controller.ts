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
  atribuirMedico(@Param('id') id: string, @Body('medicoResponsavelId') medicoId: string) {
    return this.service.atribuirMedico(id, medicoId);
  }
}
