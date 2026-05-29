import { IsString, IsOptional, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AtualizarAvaliacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utilizadorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataAvaliacao?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  pontuacaoGeral?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pontosFortes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areasMelhoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
