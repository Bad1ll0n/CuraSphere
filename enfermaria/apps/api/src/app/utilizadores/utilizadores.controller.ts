import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UtilizadoresService } from './utilizadores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, SubRoles } from '../auth/roles.decorator';
import { Servico } from '../common/enums';
import { CriarUtilizadorDto } from './dto/criar-utilizador.dto';

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

  @Get()
  listar(
    @Query('role') role?: string,
    @Query('roles') rolesParam?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const roles = rolesParam ? rolesParam.split(',') : undefined;
    return this.utilizadoresService.listar(
      role,
      roles,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.utilizadoresService.buscarPorId(id);
  }

  @Roles('ti')
  @SubRoles('it_admin')
  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() body: { nome?: string; ordemExperiencia?: number; role?: string; subRole?: string | null; servico?: Servico; equipa?: string },
  ) {
    return this.utilizadoresService.atualizar(id, body);
  }

  @Roles('ti')
  @SubRoles('it_admin')
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.utilizadoresService.desativar(id);
  }
}
