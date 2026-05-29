import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dose: string;

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
}
