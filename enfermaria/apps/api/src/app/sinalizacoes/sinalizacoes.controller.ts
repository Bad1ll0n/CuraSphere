import { Controller, Post, Patch, Get, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SinalizacoesService } from './sinalizacoes.service';
import { CriarSinalizacaoDto } from './dto/criar-sinalizacao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sinalizacoes')
export class SinalizacoesController {
  constructor(private readonly service: SinalizacoesService) {}

  @Post(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'tecnico_saude')
  criar(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarSinalizacaoDto,
    @Request() req: any,
  ) {
    return this.service.criar(doenteId, dto, req.user.sub);
  }

  @Patch(':id/resolver')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros')
  resolver(@Param('id') id: string, @Request() req: any) {
    return this.service.resolver(id, req.user.sub);
  }

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'administrativo', 'direcao', 'tecnico_saude')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listarTodas(doenteId);
  }

  @Get(':doenteId/ativas')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'administrativo', 'direcao', 'tecnico_saude')
  listarAtivas(@Param('doenteId') doenteId: string) {
    return this.service.listarAtivas(doenteId);
  }
}
