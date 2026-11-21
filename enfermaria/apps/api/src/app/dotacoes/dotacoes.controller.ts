import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DotacoesService } from './dotacoes.service';
import type { Turno } from './dotacoes.regras';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

class HorasCategoriaDto {
  @IsNumber() I: number;
  @IsNumber() II: number;
  @IsNumber() III: number;
  @IsNumber() IV: number;
}
class DistribuicaoDto {
  @IsNumber() manha: number;
  @IsNumber() tarde: number;
  @IsNumber() noite: number;
}
class MinimosGrupoDto {
  @IsInt() @Min(0) @Max(30) enfermeiro: number;
  @IsInt() @Min(0) @Max(30) auxiliar: number;
  @IsInt() @Min(0) @Max(30) medico: number;
}
class MinimosDto {
  @ValidateNested() @Type(() => MinimosGrupoDto) manha: MinimosGrupoDto;
  @ValidateNested() @Type(() => MinimosGrupoDto) tarde: MinimosGrupoDto;
  @ValidateNested() @Type(() => MinimosGrupoDto) noite: MinimosGrupoDto;
}
export class ParametrosDotacaoDto {
  @IsObject() @ValidateNested() @Type(() => HorasCategoriaDto) horasPorCategoria: HorasCategoriaDto;
  @IsObject() @ValidateNested() @Type(() => DistribuicaoDto) distribuicaoTurno: DistribuicaoDto;
  @IsNumber() horasEfetivasTurno: number;
  @IsObject() @ValidateNested() @Type(() => MinimosDto) minimos: MinimosDto;
  @IsInt() horasSemanaisMax: number;
  @IsOptional() @IsString() @MaxLength(40) competenciaObrigatoria: string | null;
}

const GESTAO = ['chefe_enfermeiros', 'chefe_turno', 'direcao'] as const;

/** PROD-17 — dotação segura (cálculo determinístico, explicável). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dotacoes')
export class DotacoesController {
  constructor(private readonly service: DotacoesService) {}

  @Get()
  @Roles(...GESTAO)
  resumo() {
    return this.service.resumo();
  }

  @Get('servicos/:servico')
  @Roles(...GESTAO)
  calcular(@Param('servico') servico: string, @Query('data') data?: string, @Query('turno') turno?: string) {
    const quando = data && turno && /^\d{4}-\d{2}-\d{2}$/.test(data) && ['manha', 'tarde', 'noite'].includes(turno) ? { data, turno: turno as Turno } : undefined;
    return this.service.calcular(servico, quando);
  }

  /** Regista já a fotografia do turno em curso (além do registo horário automático). */
  @Post('servicos/:servico/registar')
  @Roles(...GESTAO)
  registar(@Param('servico') servico: string) {
    return this.service.registar(servico);
  }

  @Get('servicos/:servico/historico')
  @Roles(...GESTAO)
  historico(@Param('servico') servico: string, @Query('dias') dias?: string) {
    return this.service.historico(servico, Math.min(Math.max(parseInt(dias ?? '14', 10) || 14, 1), 90));
  }

  @Get('servicos/:servico/parametros')
  @Roles(...GESTAO)
  parametros(@Param('servico') servico: string) {
    return this.service.parametros(servico);
  }

  @Put('servicos/:servico/parametros')
  @Roles('chefe_enfermeiros', 'direcao')
  guardar(@Param('servico') servico: string, @Body() dto: ParametrosDotacaoDto, @Request() req: PedidoAutenticado) {
    return this.service.guardarParametros(servico, req.user.sub, dto as any);
  }
}
