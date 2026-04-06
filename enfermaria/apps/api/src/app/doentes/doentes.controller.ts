import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, EstadoDoente } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doentes')
export class DoenteController {
  constructor(private readonly doenteService: DoenteService) {}

  @Get()
  listar() {
    return this.doenteService.listar();
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.doenteService.buscarPorId(id);
  }

  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.doenteService.historico(id);
  }

  @Roles(Role.administrativo, Role.chefe_enfermeiros, Role.chefe_turno)
  @Post('admitir')
  admitir(@Body() body: {
    nome: string;
    dataNascimento: Date;
    diagnosticoPrincipal: string;
    camaId: string;
    dataAltaPrevista?: Date;
  }, @Request() req: any) {
    return this.doenteService.admitir({ ...body, administrativoAdmissaoId: req.user.sub });
  }

  @Roles(Role.enfermeiro, Role.medico, Role.chefe_turno)
  @Patch(':id/estado')
  atualizarEstado(@Param('id') id: string, @Body() body: { estado: EstadoDoente }) {
    return this.doenteService.atualizarEstado(id, body.estado);
  }

  @Roles(Role.administrativo, Role.chefe_enfermeiros)
  @Patch(':id/alta')
  darAlta(@Param('id') id: string, @Request() req: any) {
    return this.doenteService.darAlta(id, req.user.sub);
  }
}
