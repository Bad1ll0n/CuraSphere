import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UtilizadoresService } from './utilizadores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, SubRoles } from '../auth/roles.decorator';
import { CriarUtilizadorDto } from './dto/criar-utilizador.dto';
import { EditarUtilizadorDto } from './dto/editar-utilizador.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('utilizadores')
export class UtilizadoresController {
  constructor(private readonly utilizadoresService: UtilizadoresService) {}

  @Roles('ti')
  @SubRoles('it_admin')
  @Post()
  criar(@Body() body: CriarUtilizadorDto) {
    return this.utilizadoresService.criar(body);
  }

  @Roles('ti', 'chefe_turno', 'chefe_enfermeiros', 'direcao', 'administrativo', 'operacional', 'qualidade')
  @Get()
  listar(
    @Query('role') role?: string,
    @Query('roles') rolesParam?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const roles = rolesParam ? rolesParam.split(',') : undefined;
    const pageNum = Math.max(1, page ? parseInt(page, 10) || 1 : 1);
    const limitNum = Math.min(100, Math.max(1, limit ? parseInt(limit, 10) || 50 : 50));
    return this.utilizadoresService.listar(role, roles, pageNum, limitNum);
  }

  @Roles('ti')
  @SubRoles('it_admin')
  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.utilizadoresService.buscarPorId(id);
  }

  @Roles('ti')
  @SubRoles('it_admin')
  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: EditarUtilizadorDto,
  ) {
    return this.utilizadoresService.atualizar(id, dto);
  }

  @Roles('ti')
  @SubRoles('it_admin')
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.utilizadoresService.desativar(id);
  }
}
