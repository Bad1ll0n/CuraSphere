import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UtilizadoresService } from './utilizadores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, SubRole, Servico } from '../common/enums';
import { CriarUtilizadorDto } from './dto/criar-utilizador.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('utilizadores')
export class UtilizadoresController {
  constructor(private readonly utilizadoresService: UtilizadoresService) {}

  @Roles(Role.it_admin)
  @Post()
  criar(@Body() body: CriarUtilizadorDto) {
    return this.utilizadoresService.criar(body);
  }

  @Get()
  listar(@Query('role') role?: Role, @Query('roles') rolesParam?: string) {
    const roles = rolesParam ? (rolesParam.split(',') as Role[]) : undefined;
    return this.utilizadoresService.listar(role, roles);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.utilizadoresService.buscarPorId(id);
  }

  @Roles(Role.it_admin)
  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() body: { nome?: string; ordemExperiencia?: number; role?: Role; subRole?: SubRole | null; servico?: Servico; equipa?: string },
  ) {
    return this.utilizadoresService.atualizar(id, body);
  }

  @Roles(Role.it_admin)
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.utilizadoresService.desativar(id);
  }
}
