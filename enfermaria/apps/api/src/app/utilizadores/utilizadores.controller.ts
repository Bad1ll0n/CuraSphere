import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UtilizadoresService } from './utilizadores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('utilizadores')
export class UtilizadoresController {
  constructor(private readonly utilizadoresService: UtilizadoresService) {}

  @Roles(Role.chefe_enfermeiros)
  @Post()
  criar(@Body() body: {
    numeroFuncionario: string;
    nome: string;
    password: string;
    role: Role;
    ordemExperiencia?: number;
  }) {
    return this.utilizadoresService.criar(body);
  }

  @Get()
  listar(@Query('role') role?: Role) {
    return this.utilizadoresService.listar(role);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.utilizadoresService.buscarPorId(id);
  }

  @Roles(Role.chefe_enfermeiros)
  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() body: { nome?: string; ordemExperiencia?: number; role?: Role; equipa?: string },
  ) {
    return this.utilizadoresService.atualizar(id, body);
  }

  @Roles(Role.chefe_enfermeiros)
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.utilizadoresService.desativar(id);
  }
}
