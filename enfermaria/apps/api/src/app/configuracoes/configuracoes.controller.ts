import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, SubRoles } from '../auth/roles.decorator';
import { ConfiguracoesService } from './configuracoes.service';
import { CriarRoleDto } from './dto/criar-role.dto';
import { EditarRoleDto } from './dto/editar-role.dto';
import { CriarSubRoleDto } from './dto/criar-subrole.dto';
import { EditarSubRoleDto } from './dto/editar-subrole.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracoesService) {}

  // ── Roles ─────────────────────────────────────────────────────────────────

  @Get('roles')
  listarRoles() {
    return this.service.listarRoles();
  }

  @Post('roles')
  @Roles('ti')
  @SubRoles('it_admin')
  criarRole(@Body() dto: CriarRoleDto) {
    return this.service.criarRole(dto);
  }

  @Patch('roles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  editarRole(@Param('id') id: string, @Body() dto: EditarRoleDto) {
    return this.service.editarRole(id, dto);
  }

  @Delete('roles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  desativarRole(@Param('id') id: string) {
    return this.service.desativarRole(id);
  }

  // ── SubRoles ──────────────────────────────────────────────────────────────

  @Get('subroles')
  listarSubRoles() {
    return this.service.listarSubRoles();
  }

  @Get('roles/:chave/subroles')
  listarSubRolesPorRole(@Param('chave') chave: string) {
    return this.service.listarSubRolesPorRole(chave);
  }

  @Post('subroles')
  @Roles('ti')
  @SubRoles('it_admin')
  criarSubRole(@Body() dto: CriarSubRoleDto) {
    return this.service.criarSubRole(dto);
  }

  @Patch('subroles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  editarSubRole(@Param('id') id: string, @Body() dto: EditarSubRoleDto) {
    return this.service.editarSubRole(id, dto);
  }

  @Delete('subroles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  desativarSubRole(@Param('id') id: string) {
    return this.service.desativarSubRole(id);
  }
}
