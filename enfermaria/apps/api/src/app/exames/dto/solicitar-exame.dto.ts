import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoExameEnum {
  analise_clinica = 'analise_clinica',
  rx = 'rx',
  eco = 'eco',
  tc = 'tc',
  rmn = 'rmn',
  ecg = 'ecg',
  outro = 'outro',
}

export class SolicitarExameDto {
  @ApiProperty({ enum: TipoExameEnum })
  @IsEnum(TipoExameEnum)
  tipo: string;

  @ApiProperty()
  @IsString()
  descricao: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  urgente?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
