import {
  IsEnum, IsOptional, IsString, IsInt, IsBoolean, IsDateString,
  Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarAvaliacaoFerida {
  @ApiProperty({ enum: ['ulcera_pressao', 'ulcera_venosa', 'ulcera_arterial', 'cirurgica', 'traumatica', 'queimadura', 'outra'] })
  @IsEnum(['ulcera_pressao', 'ulcera_venosa', 'ulcera_arterial', 'cirurgica', 'traumatica', 'queimadura', 'outra'])
  tipo: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  localizacao: string;

  @ApiProperty({ enum: ['fase_inflamacao', 'fase_proliferacao', 'fase_maturacao', 'cronificada'] })
  @IsEnum(['fase_inflamacao', 'fase_proliferacao', 'fase_maturacao', 'cronificada'])
  estadoCicatrizacao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  comprimento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  largura?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  profundidade?: number;

  @ApiPropertyOptional({ enum: ['granulacao', 'fibrina', 'necrose_humida', 'necrose_seca', 'epitelizacao', 'misto'] })
  @IsOptional()
  @IsEnum(['granulacao', 'fibrina', 'necrose_humida', 'necrose_seca', 'epitelizacao', 'misto'])
  leito?: string;

  @ApiPropertyOptional({ enum: ['nenhum', 'escasso', 'moderado', 'abundante'] })
  @IsOptional()
  @IsEnum(['nenhum', 'escasso', 'moderado', 'abundante'])
  exsudadoVolume?: string;

  @ApiPropertyOptional({ enum: ['seroso', 'sero_sanguinolento', 'sanguinolento', 'purulento'] })
  @IsOptional()
  @IsEnum(['seroso', 'sero_sanguinolento', 'sanguinolento', 'purulento'])
  exsudadoTipo?: string;

  @ApiPropertyOptional({ enum: ['normal', 'eritema', 'edema', 'macerada', 'seca', 'callosa'] })
  @IsOptional()
  @IsEnum(['normal', 'eritema', 'edema', 'macerada', 'seca', 'callosa'])
  periferia?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  dor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  odor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pensoAplicado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proximaTroca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}
