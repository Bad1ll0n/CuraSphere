import { Body, Controller, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AcessoDoentePor } from '../doentes/acesso-doente.decorator';
import { ProcessoEnfermagemService } from './processo-enfermagem.service';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

export class AvaliacaoInicialDto {
  @ApiProperty() @IsObject() dados!: Record<string, unknown>;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() completa?: boolean;
}

export class NovaIntervencaoDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() catalogoId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) termo?: string;
  @ApiProperty() @IsString() @MaxLength(40) frequencia!: string;
}

export class NovoDiagnosticoDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() catalogoId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) termo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) juizo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) resultadoEsperado?: string;
  @ApiPropertyOptional() @IsIn(['manual', 'escala', 'conjunto']) @IsOptional() origem?: 'manual' | 'escala' | 'conjunto';
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) origemRef?: string;
  @ApiPropertyOptional({ type: [NovaIntervencaoDto] })
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => NovaIntervencaoDto) @IsOptional()
  intervencoes?: NovaIntervencaoDto[];
}

export class EncerrarDiagnosticoDto {
  @ApiProperty() @IsIn(['resolvido', 'cancelado']) estado!: 'resolvido' | 'cancelado';
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) motivo?: string;
}

export class AvaliarDiagnosticoDto {
  @ApiProperty() @IsIn(['melhorou', 'igual', 'piorou', 'resolvido']) evolucao!: 'melhorou' | 'igual' | 'piorou' | 'resolvido';
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) nota?: string;
}

export class AlterarIntervencaoDto {
  @ApiPropertyOptional() @IsIn(['ativa', 'suspensa', 'concluida']) @IsOptional() estado?: 'ativa' | 'suspensa' | 'concluida';
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) frequencia?: string;
}

export class ExecucaoDto {
  @ApiPropertyOptional() @IsISO8601() @IsOptional() executadaEm?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() realizada?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) nota?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) motivoNaoRealizada?: string;
}

const ENFERMAGEM = ['enfermeiro', 'chefe_enfermeiros'] as const;
const LEITURA = [...ENFERMAGEM, 'medico', 'auxiliar'] as const;

/**
 * PROD-07 — processo de enfermagem. Rotas com :doenteId são verificadas pelo interceptor de
 * acesso; as rotas por id de diagnóstico/intervenção resolvem o doente pelo decorador.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('processo-enfermagem')
export class ProcessoEnfermagemController {
  constructor(private readonly service: ProcessoEnfermagemService) {}

  @Get('catalogo')
  @Roles(...LEITURA)
  catalogo(@Query('tipo') tipo?: string, @Query('servico') servico?: string) {
    return this.service.catalogo(tipo, servico);
  }

  @Get('conjuntos')
  @Roles(...LEITURA)
  conjuntos(@Query('servico') servico?: string) {
    return this.service.conjuntos(servico);
  }

  @Post('catalogo/importar-base')
  @Roles('chefe_enfermeiros', 'ti')
  importarBase() {
    return this.service.importarCatalogoBase();
  }

  @Get('doente/:doenteId/plano')
  @Roles(...LEITURA)
  plano(@Param('doenteId') doenteId: string) {
    return this.service.plano(doenteId);
  }

  @Get('doente/:doenteId/avaliacao-inicial')
  @Roles(...LEITURA)
  avaliacaoInicial(@Param('doenteId') doenteId: string) {
    return this.service.avaliacaoInicial(doenteId);
  }

  @Put('doente/:doenteId/avaliacao-inicial')
  @Roles(...ENFERMAGEM)
  guardarAvaliacaoInicial(@Param('doenteId') doenteId: string, @Body() dto: AvaliacaoInicialDto, @Request() req: PedidoAutenticado) {
    return this.service.guardarAvaliacaoInicial(doenteId, req.user.sub, dto);
  }

  @Post('doente/:doenteId/diagnosticos')
  @Roles(...ENFERMAGEM)
  criarDiagnostico(@Param('doenteId') doenteId: string, @Body() dto: NovoDiagnosticoDto, @Request() req: PedidoAutenticado) {
    return this.service.criarDiagnostico(doenteId, req.user.sub, dto);
  }

  @Post('doente/:doenteId/conjuntos/:conjuntoId')
  @Roles(...ENFERMAGEM)
  aplicarConjunto(@Param('doenteId') doenteId: string, @Param('conjuntoId') conjuntoId: string, @Request() req: PedidoAutenticado) {
    return this.service.aplicarConjunto(doenteId, req.user.sub, conjuntoId);
  }

  @Patch('diagnosticos/:id/encerrar')
  @Roles(...ENFERMAGEM)
  @AcessoDoentePor('diagnosticoEnfermagem')
  encerrar(@Param('id') id: string, @Body() dto: EncerrarDiagnosticoDto, @Request() req: PedidoAutenticado) {
    return this.service.encerrarDiagnostico(id, req.user.sub, dto);
  }

  @Post('diagnosticos/:id/avaliacoes')
  @Roles(...ENFERMAGEM)
  @AcessoDoentePor('diagnosticoEnfermagem')
  avaliar(@Param('id') id: string, @Body() dto: AvaliarDiagnosticoDto, @Request() req: PedidoAutenticado) {
    return this.service.avaliarDiagnostico(id, req.user.sub, dto);
  }

  @Patch('intervencoes/:id')
  @Roles(...ENFERMAGEM)
  @AcessoDoentePor('intervencaoEnfermagem')
  alterarIntervencao(@Param('id') id: string, @Body() dto: AlterarIntervencaoDto) {
    return this.service.alterarIntervencao(id, dto);
  }

  @Post('intervencoes/:id/execucoes')
  @Roles(...ENFERMAGEM, 'auxiliar')
  @AcessoDoentePor('intervencaoEnfermagem')
  registarExecucao(@Param('id') id: string, @Body() dto: ExecucaoDto, @Request() req: PedidoAutenticado) {
    return this.service.registarExecucao(id, req.user.sub, dto);
  }
}
