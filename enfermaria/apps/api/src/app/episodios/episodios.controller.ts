import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EpisodiosService } from './episodios.service';

/** PROD-02 — indicadores que só existem com episódios (as rotas por doente vivem em /doentes). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('episodios')
export class EpisodiosController {
  constructor(private readonly service: EpisodiosService) {}

  /** Taxa de reinternamento a N dias (por omissão 30) — indicador de contrato-programa. */
  @Get('indicadores/reinternamentos')
  @Roles('direcao', 'qualidade', 'chefe_medicos', 'chefe_enfermeiros')
  reinternamentos(
    @Query('dias') dias?: string, @Query('desde') desde?: string, @Query('ate') ate?: string, @Query('servico') servico?: string,
  ) {
    const n = Number(dias ?? 30);
    return this.service.indicadorReinternamentos(Number.isFinite(n) && n > 0 && n <= 365 ? n : 30, desde, ate, servico);
  }
}
