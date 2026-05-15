import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EquipamentosService } from './equipamentos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('equipamentos')
export class EquipamentosController {
  constructor(private readonly service: EquipamentosService) {}

  @Get()
  @Roles('operacional', 'ti', 'direcao', 'administrativo', 'enfermeiro', 'medico')
  listar(@Query('search') search?: string, @Query('estado') estado?: string) {
    return this.service.listar(search, estado);
  }

  @Post()
  @Roles('operacional', 'ti')
  criar(@Body() body: { nome: string; tipo: string; numeroSerie?: string; localizacao?: string; proximaManutencao?: string }) {
    return this.service.criar(body);
  }

  @Patch(':id')
  @Roles('operacional', 'ti')
  atualizar(
    @Param('id') id: string,
    @Body() body: { nome?: string; tipo?: string; numeroSerie?: string; localizacao?: string; estado?: string; proximaManutencao?: string },
  ) {
    return this.service.atualizar(id, body);
  }

  @Get('alertas-manutencao')
  @Roles('operacional', 'ti', 'medico', 'enfermeiro', 'direcao')
  alertasManutencao() {
    return this.service.alertasManutencao();
  }

  @Get('manutencoes')
  @Roles('operacional', 'ti', 'direcao', 'administrativo')
  listarManutencoes() {
    return this.service.listarManutencoes();
  }

  @Get(':id/manutencoes')
  @Roles('operacional', 'ti', 'direcao', 'administrativo', 'enfermeiro', 'medico')
  listarManutencoesEquipamento(@Param('id') id: string) {
    return this.service.listarManutencoes(id);
  }

  @Post(':id/manutencoes')
  @Roles('operacional', 'ti', 'enfermeiro', 'medico', 'auxiliar')
  criarManutencao(
    @Param('id') equipamentoId: string,
    @Body() body: { tipo: string; descricao: string; prioridade?: string; observacoes?: string },
    @Request() req: any,
  ) {
    return this.service.criarManutencao(equipamentoId, body, req.user.sub);
  }

  @Patch('manutencoes/:id')
  @Roles('operacional', 'ti')
  atualizarManutencao(
    @Param('id') id: string,
    @Body() body: { estado?: string; observacoes?: string; tecnicoId?: string },
  ) {
    return this.service.atualizarManutencao(id, body);
  }
}
