import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
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

  @ApiPropertyOptional()
  @IsOptional()
  o2Suplementar?: boolean;

  @ApiPropertyOptional({ description: 'Glasgow Coma Scale 3-15 (para SOFA SNC)' })
  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(15)
  @Type(() => Number)
  glasgow?: number;

  @ApiPropertyOptional({ description: 'Pressão Arterial Média mmHg (para SOFA cardiovascular)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200)
  @Type(() => Number)
  pamMedia?: number;

  @ApiPropertyOptional({ description: 'Em suporte vasopressor (para SOFA cardiovascular)' })
  @IsBoolean()
  @IsOptional()
  vasopressores?: boolean;
}
