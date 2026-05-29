import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoDispositivoEnum {
  cateter_venoso_central = 'cateter_venoso_central',
  cateter_venoso_periferico = 'cateter_venoso_periferico',
  cateter_arterial = 'cateter_arterial',
  sonda_nasogastrica = 'sonda_nasogastrica',
  sonda_vesical = 'sonda_vesical',
  dreno_toracico = 'dreno_toracico',
  dreno_abdominal = 'dreno_abdominal',
  tubo_orotraqueal = 'tubo_orotraqueal',
  mascara_ventilacao = 'mascara_ventilacao',
  pacemaker_temporario = 'pacemaker_temporario',
  outro = 'outro',
}

export class CriarDispositivoDto {
  @ApiProperty({ enum: TipoDispositivoEnum })
  @IsEnum(TipoDispositivoEnum)
  tipo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localizacao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
