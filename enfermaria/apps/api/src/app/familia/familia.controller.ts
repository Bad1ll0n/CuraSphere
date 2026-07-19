import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FamiliaService, CriarAcessoFamiliarDto } from './familia.service';

@Controller('familia')
export class FamiliaController {
  constructor(private readonly service: FamiliaService) {}

  // Rota pública — sem autenticação JWT
  @Get('portal/:token')
  portalPublico(@Param('token') token: string) {
    return this.service.portalDoente(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('acesso/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  criarAcesso(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarAcessoFamiliarDto,
    @Request() req: any,
  ) {
    return this.service.criarAcesso(doenteId, dto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('acessos/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  listarAcessos(@Param('doenteId') doenteId: string) {
    return this.service.listarAcessos(doenteId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  revogarAcesso(@Param('id') id: string) {
    return this.service.revogarAcesso(id);
  }
}
