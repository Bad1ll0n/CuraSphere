import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty, IsBoolean, IsInt, Min, Max, MaxLength, IsUUID, IsIn, IsNumber, IsPositive, ValidateIf } from 'class-validator';
import { UNIDADES_DOSE } from '@org/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ViaAdministracaoEnum {
  oral = 'oral',
  iv = 'iv',
  im = 'im',
  sc = 'sc',
  topica = 'topica',
  inalacao = 'inalacao',
  sublingual = 'sublingual',
  retal = 'retal',
  nasal = 'nasal',
  ocular = 'ocular',
  sng = 'sng',
  outro = 'outro',
}

export class PrescreverMedicacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  // UX-17: a dose pode vir estruturada (doseValor + doseUnidade); então o texto é composto no
  // servidor e este campo é opcional.
  @ApiProperty()
  @ValidateIf((o) => o.doseValor === undefined || o.doseUnidade === undefined)
  @IsString()
  @IsNotEmpty()
  dose: string;

  @ApiPropertyOptional({ description: 'Valor da dose (com doseUnidade)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  doseValor?: number;

  @ApiPropertyOptional({ enum: UNIDADES_DOSE })
  @IsOptional()
  @IsIn(UNIDADES_DOSE as unknown as string[])
  doseUnidade?: string;

  @ApiPropertyOptional({ description: 'Para que é (indicação clínica)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  indicacao?: string;

  @ApiPropertyOptional({ description: 'Duração prevista em dias (1–365); sem valor = até nova ordem' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  duracaoDias?: number;

  @ApiProperty({ enum: ViaAdministracaoEnum })
  @IsEnum(ViaAdministracaoEnum)
  via: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frequencia: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  iniciadoEm?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  terminadoEm?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;

  // A API recusava estes dois (whitelist): o override de alergia/interacção nunca funcionava.
  @ApiPropertyOptional({ description: 'Prescrever apesar de alergia documentada (exige justificativaOverride)' })
  @IsBoolean()
  @IsOptional()
  forcarApesarDeAlergia?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  justificativaOverride?: string;

  // QA-07: dose acima do máximo de adulto.
  @ApiPropertyOptional({ description: 'Prescrever acima da dose máxima (exige justificativaDose)' })
  @IsBoolean()
  @IsOptional()
  forcarDoseAcimaMaximo?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  justificativaDose?: string;

  // QA-08: SOS.
  @ApiPropertyOptional({ description: 'SOS: intervalo mínimo entre tomas (horas). Obrigatório em SOS.' })
  @IsInt()
  @Min(1)
  @Max(72)
  @IsOptional()
  intervaloMinimoH?: number;

  @ApiPropertyOptional({ description: 'SOS: número máximo de tomas em 24 h.' })
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  maxDosesDia?: number;

  // PROD-05: catálogo, duplicação e interacção.
  @ApiPropertyOptional({ description: 'Item do catálogo escolhido no autocomplete' })
  @IsUUID()
  @IsOptional()
  catalogoId?: string;

  @ApiPropertyOptional({ description: 'Prescrição fora do catálogo: justificação' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  justificacaoForaCatalogo?: string;

  @ApiPropertyOptional({ description: 'Prescrever apesar de a mesma substância já estar prescrita' })
  @IsBoolean()
  @IsOptional()
  forcarDuplicacao?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  justificativaDuplicacao?: string;

  @ApiPropertyOptional({ description: 'Prescrever apesar de interacção grave/contraindicada' })
  @IsBoolean()
  @IsOptional()
  forcarInteracao?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  justificativaInteracao?: string;
}
