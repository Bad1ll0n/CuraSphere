import {
  IsString, IsOptional, IsNotEmpty, IsIn, IsNumber, IsInt,
  IsBoolean, IsArray, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PreNotificacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeTemporario?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  queixaPrincipal!: string;

  @ApiProperty({ enum: ['verde', 'amarelo', 'laranja', 'vermelho', 'azul'] })
  @IsIn(['verde', 'amarelo', 'laranja', 'vermelho', 'azul'])
  triagem!: string;

  @ApiProperty({ minimum: 1, maximum: 120 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  etaMinutos!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  condicaoPrevia?: string;

  // Doente pré-hospitalar
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  idadeAproximada?: number;

  @ApiPropertyOptional({ enum: ['masculino', 'feminino', 'desconhecido'] })
  @IsOptional()
  @IsIn(['masculino', 'feminino', 'desconhecido'])
  sexo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consciente?: boolean;

  @ApiPropertyOptional({ minimum: 3, maximum: 15 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  glasgow?: number;

  @ApiPropertyOptional({ enum: ['medico', 'trauma', 'intoxicacao', 'obstetrico', 'pediatrico'] })
  @IsOptional()
  @IsIn(['medico', 'trauma', 'intoxicacao', 'obstetrico', 'pediatrico'])
  mecanismo?: string;

  // Vitais en route
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  vitalsPASistolica?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  vitalsPADiastolica?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  vitalsFC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  vitalsSpO2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  vitalsFR?: number;

  // Intervenções INEM
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intervencoes?: string[];
}
