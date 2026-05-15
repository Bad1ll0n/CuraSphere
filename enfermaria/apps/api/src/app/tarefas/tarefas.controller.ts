import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TarefasService } from './tarefas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tarefas')
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  @Get('minhas')
  listarMinhas(@Request() req: any) {
    return this.tarefasService.listarPorResponsavel(req.user.sub);
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.tarefasService.listarPorDoente(doenteId);
  }

  @Post()
  criar(@Body() body: {
    doenteId: string;
    tipo: TipoTarefa;
    descricao: string;
    prioridade: PrioridadeTarefa;
    prazo?: Date;
  }, @Request() req: any) {
    return this.tarefasService.criar({ ...body, criadoPorId: req.user.sub });
  }

  @Patch(':id/estado')
  atualizarEstado(
    @Param('id') id: string,
    @Body() body: { estado: EstadoTarefa },
  ) {
    return this.tarefasService.atualizarEstado(id, body.estado);
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() body: { descricao?: string; prioridade?: PrioridadeTarefa; prazo?: string | null; grupoResponsavel?: string },
  ) {
    return this.tarefasService.editar(id, body);
  }
}
