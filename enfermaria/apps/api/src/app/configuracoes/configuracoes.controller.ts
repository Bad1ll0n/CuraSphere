import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, SubRoles } from '../auth/roles.decorator';
import { ConfiguracoesService } from './configuracoes.service';

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
  criarRole(@Body() body: { chave: string; label: string; categoria: string; ordem?: number }) {
    return this.service.criarRole(body);
  }

  @Patch('roles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  editarRole(@Param('id') id: string, @Body() body: { label?: string; categoria?: string; ordem?: number }) {
    return this.service.editarRole(id, body);
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
  criarSubRole(@Body() body: { chave: string; label: string; roleChave: string; ordem?: number }) {
    return this.service.criarSubRole(body);
  }

  @Patch('subroles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  editarSubRole(@Param('id') id: string, @Body() body: { label?: string; ordem?: number }) {
    return this.service.editarSubRole(id, body);
  }

  @Delete('subroles/:id')
  @Roles('ti')
  @SubRoles('it_admin')
  desativarSubRole(@Param('id') id: string) {
    return this.service.desativarSubRole(id);
  }
}
