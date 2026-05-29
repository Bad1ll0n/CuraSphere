import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AvpuEnum {
  A = 'A',
  V = 'V',
  P = 'P',
  U = 'U',
}

export class CriarSinalVitalDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(300)
  @Type(() => Number)
  pressaoSistolica?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200)
  @Type(() => Number)
  pressaoDiastolica?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(300)
  @Type(() => Number)
  pulso?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(30)
  @Max(45)
  @Type(() => Number)
  temperatura?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  saturacaoO2?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  frequenciaRespiratoria?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  @Type(() => Number)
  peso?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({ enum: AvpuEnum })
  @IsEnum(AvpuEnum)
  @IsOptional()
  avpu?: string;
}
