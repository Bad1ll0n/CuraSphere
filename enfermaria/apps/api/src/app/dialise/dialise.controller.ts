import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { DialiseService } from './dialise.service';
import { RegistarSessaoDto } from './dto/registar-sessao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dialise')
export class DialiseController {
  constructor(
    private readonly service: DialiseService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get('doente/:doenteId/sessoes')
  @Roles('medico', 'enfermeiro')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarSessoes(doenteId);
  }

  @Post('doente/:doenteId/sessao')
  @Roles('medico', 'enfermeiro')
  async registar(@Param('doenteId') doenteId: string, @Body() dto: RegistarSessaoDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.registarSessao(doenteId, dto, req.user.sub);
  }
}
