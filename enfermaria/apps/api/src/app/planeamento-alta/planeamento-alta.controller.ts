import { Body, Controller, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AcessoDoentePor } from '../doentes/acesso-doente.decorator';
import { PlaneamentoAltaService } from './planeamento-alta.service';
import { COMPREENSAO, DESTINATARIOS, ESTADOS_REFERENCIACAO, type EstadoReferenciacao } from './planeamento-alta.regras';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

export class AltaClinicaDto {
  @IsBoolean() altaClinica: boolean;
}

export class CriarReferenciacaoDto {
  @IsString() @MaxLength(40) destino: string;
  @IsString() @MinLength(5) @MaxLength(1000) motivo: string;
}

export class EstadoReferenciacaoDto {
  @IsIn(ESTADOS_REFERENCIACAO as unknown as string[]) estado: EstadoReferenciacao;
  @IsOptional() @IsString() @MaxLength(1000) nota?: string;
}

export class EnsinoDto {
  @IsString() @MaxLength(40) tema: string;
  @IsOptional() @IsString() @MaxLength(200) titulo?: string;
  @IsIn(DESTINATARIOS as unknown as string[]) destinatario: string;
  @IsOptional() @IsString() @MaxLength(200) cuidadorNome?: string;
  @IsIn(COMPREENSAO as unknown as string[]) compreensao: string;
  @IsOptional() @IsString() @MaxLength(1000) nota?: string;
}

const EQUIPA = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'] as const;

/** PROD-13 — planeamento de alta e continuidade de cuidados. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planeamento-alta')
export class PlaneamentoAltaController {
  constructor(private readonly service: PlaneamentoAltaService) {}

  @Get('catalogo')
  @Roles(...EQUIPA, 'direcao')
  catalogo() {
    return this.service.catalogo();
  }

  @Get('altas-proteladas')
  @Roles('chefe_enfermeiros', 'chefe_turno', 'medico', 'direcao')
  altasProteladas(@Query('servico') servico?: string) {
    return this.service.altasProteladas(servico || undefined);
  }

  @Get('doente/:doenteId')
  @Roles(...EQUIPA, 'direcao')
  resumo(@Param('doenteId') doenteId: string) {
    return this.service.resumo(doenteId);
  }

  @Put('doente/:doenteId/alta-clinica')
  @Roles('medico')
  altaClinica(@Param('doenteId') doenteId: string, @Body() dto: AltaClinicaDto, @Request() req: PedidoAutenticado) {
    return this.service.marcarAltaClinica(doenteId, req.user.sub, dto.altaClinica);
  }

  @Post('doente/:doenteId/referenciacoes')
  @Roles(...EQUIPA)
  referenciar(@Param('doenteId') doenteId: string, @Body() dto: CriarReferenciacaoDto, @Request() req: PedidoAutenticado) {
    return this.service.criarReferenciacao(doenteId, req.user.sub, dto);
  }

  @Patch('referenciacoes/:id')
  @Roles(...EQUIPA)
  @AcessoDoentePor('referenciacaoContinuidade')
  estado(@Param('id') id: string, @Body() dto: EstadoReferenciacaoDto, @Request() req: PedidoAutenticado) {
    return this.service.alterarEstado(id, req.user.sub, dto);
  }

  @Post('doente/:doenteId/ensinos')
  @Roles('enfermeiro', 'chefe_enfermeiros', 'chefe_turno')
  ensino(@Param('doenteId') doenteId: string, @Body() dto: EnsinoDto, @Request() req: PedidoAutenticado) {
    return this.service.registarEnsino(doenteId, req.user.sub, dto);
  }
}
