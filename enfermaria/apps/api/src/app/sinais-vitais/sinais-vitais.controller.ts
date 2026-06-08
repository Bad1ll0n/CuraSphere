import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SinaisVitaisService } from './sinais-vitais.service';
import { DoenteService } from '../doentes/doentes.service';
import { CriarSinalVitalDto } from './dto/criar-sinal-vital.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sinais-vitais')
export class SinaisVitaisController {
  constructor(
    private readonly service: SinaisVitaisService,
    private readonly doenteService: DoenteService,
  ) {}

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude')
  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarSinalVitalDto, @Request() req: any) {
    return this.service.criar(doenteId, req.user.sub, req.user.role, dto);
  }

  @Get(':doenteId')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/ultimo')
  async ultimo(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.ultimo(doenteId);
  }

  @Get(':doenteId/scores')
  async calcularScores(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.calcularScores(doenteId);
  }

  @Get(':doenteId/tendencia')
  async analisarTendencia(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.analisarTendencia(doenteId);
  }
}
