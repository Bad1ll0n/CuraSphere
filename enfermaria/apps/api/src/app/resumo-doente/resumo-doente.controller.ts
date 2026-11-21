import { Body, Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResumoDoenteService } from './resumo-doente.service';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

export class NaoReanimarDto {
  @ApiProperty() @IsBoolean() ativo!: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) notas?: string;
}

/** UX-29 / UX-30 — faixa de identificação e "O meu turno". Rotas com :doenteId verificam o acesso ao doente. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resumo')
export class ResumoDoenteController {
  constructor(private readonly service: ResumoDoenteService) {}

  @Get('meu-turno')
  @Roles('enfermeiro', 'auxiliar', 'medico')
  meuTurno(@Request() req: PedidoAutenticado) {
    return this.service.meuTurno(req.user.sub);
  }

  @Get('doente/:doenteId/faixa')
  faixa(@Param('doenteId') doenteId: string) {
    return this.service.faixa(doenteId);
  }

  /** UX-08: dados da pulseira (QR com processo e data de nascimento) para imprimir. */
  @Get('doente/:doenteId/pulseira')
  @Roles('enfermeiro', 'administrativo', 'medico')
  pulseira(@Param('doenteId') doenteId: string) {
    return this.service.pulseira(doenteId);
  }

  @Patch('doente/:doenteId/nao-reanimar')
  @Roles('medico')
  naoReanimar(@Param('doenteId') doenteId: string, @Body() dto: NaoReanimarDto, @Request() req: PedidoAutenticado) {
    return this.service.definirNaoReanimar(doenteId, req.user.sub, dto);
  }
}
