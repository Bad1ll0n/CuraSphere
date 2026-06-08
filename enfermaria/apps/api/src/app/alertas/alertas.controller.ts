import { Controller, Get, Post, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AlertasService } from './alertas.service';
import { DoenteService } from '../doentes/doentes.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alertas')
export class AlertasController {
  constructor(
    private readonly service: AlertasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get()
  @Roles('medico', 'chefe_turno', 'chefe_enfermeiros', 'direcao', 'qualidade')
  listarGlobal(
    @Query('tipo') tipo?: string,
    @Query('lido') lido?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listarGlobal({
      tipo,
      lido: lido === 'false' ? false : lido === 'true' ? true : undefined,
      limit: limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
    });
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarNaoLidos(doenteId);
  }

  @Patch(':id/ler')
  async marcarLido(@Param('id') id: string, @Request() req: any) {
    const doenteId = await this.service.getDoenteIdByAlertaId(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.marcarLido(id);
  }

  @Patch(':doenteId/ler-todos')
  async marcarTodosLidos(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.marcarTodosLidos(doenteId);
  }

  @Post(':doenteId/sos')
  acionarSOS(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.acionarSOS(doenteId, req.user.sub);
  }

  @Patch(':id/acusar')
  acusar(@Param('id') id: string, @Request() req: any) {
    return this.service.acusar(id, req.user.sub);
  }
}
