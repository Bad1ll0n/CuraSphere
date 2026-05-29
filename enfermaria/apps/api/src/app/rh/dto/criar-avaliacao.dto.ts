import { IsString, IsOptional, IsNumber, IsNotEmpty, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarAvaliacaoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  utilizadorId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  periodo: string;

  @ApiProperty()
  @IsDateString()
  dataAvaliacao: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  pontuacaoGeral: number;

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
