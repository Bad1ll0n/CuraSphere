import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RgpdService, politicaRetencao } from './rgpd.service';

export class AnonimizarDto {
  @IsString() @MinLength(10) @MaxLength(500) motivo: string;
}

/**
 * SEC-20 — direitos do titular do lado da instituição (DPO / qualidade): responder a um pedido de
 * acesso feito ao balcão (sem portal), ver a política de retenção e os processos elegíveis, e
 * anonimizar um processo fora do prazo. O titular com portal exporta em `GET /portal/exportar/json`.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rgpd')
export class RgpdController {
  constructor(private readonly service: RgpdService) {}

  @Roles('qualidade', 'direcao')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  @Get('titular/:doenteId/exportacao')
  exportar(@Param('doenteId', ParseUUIDPipe) doenteId: string, @Request() req: any) {
    return this.service.exportar(doenteId, { utilizadorId: req.user.sub, via: 'dpo' });
  }

  @Roles('qualidade', 'direcao')
  @Get('retencao')
  async retencao() {
    return { politica: politicaRetencao(), elegiveis: await this.service.elegiveis() };
  }

  @Roles('qualidade')
  @Throttle({ default: { ttl: 3600000, limit: 50 } })
  @Post('titular/:doenteId/anonimizar')
  anonimizar(@Param('doenteId', ParseUUIDPipe) doenteId: string, @Body() dto: AnonimizarDto, @Request() req: any) {
    return this.service.anonimizar(doenteId, req.user.sub, dto.motivo);
  }
}
