import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarAtoClinicoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codigo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  precoBase?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  especialidade?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
