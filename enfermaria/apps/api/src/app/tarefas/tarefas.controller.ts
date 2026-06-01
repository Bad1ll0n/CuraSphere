import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Sse } from '@nestjs/common';
import { map } from 'rxjs';
import { TarefasService } from './tarefas.service';
import { DoenteService } from '../doentes/doentes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa } from '../common/enums';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarEstadoTarefaDto } from './dto/atualizar-estado-tarefa.dto';
import { EditarTarefaDto } from './dto/editar-tarefa.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tarefas')
export class TarefasController {
  constructor(
    private readonly tarefasService: TarefasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get('minhas')
  listarMinhas(@Request() req: any) {
    return this.tarefasService.listarPorResponsavel(req.user.sub);
  }

  @Sse('eventos')
  eventos() {
    return this.tarefasService.eventStream().pipe(
      map((evento) => ({ type: evento.type, data: evento.data })),
    );
  }

  @Get('doente/:doenteId')
  async listarPorDoente(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.tarefasService.listarPorDoente(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'chefe_enfermeiros', 'chefe_turno', 'administrativo')
  @Post()
  criar(@Body() dto: CriarTarefaDto, @Request() req: any) {
    return this.tarefasService.criar({ ...dto, criadoPorId: req.user.sub });
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'chefe_enfermeiros', 'chefe_turno', 'administrativo')
  @Patch(':id/estado')
  atualizarEstado(
    @Param('id') id: string,
    @Body() dto: AtualizarEstadoTarefaDto,
  ) {
    return this.tarefasService.atualizarEstado(id, dto.estado as EstadoTarefa);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'administrativo')
  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarTarefaDto,
  ) {
    return this.tarefasService.editar(id, dto);
  }
}
