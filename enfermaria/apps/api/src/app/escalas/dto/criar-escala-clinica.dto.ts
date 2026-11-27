import { IsString, IsOptional, IsNumber, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarEscalaClinicaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty()
  @IsObject()
  valores: Record<string, any>;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  pontuacao?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  classificacao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
