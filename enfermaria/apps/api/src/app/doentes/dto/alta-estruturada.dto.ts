import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MotivoAltaEnum {
  melhoria = 'melhoria',
  transferencia = 'transferencia',
  alta_voluntaria = 'alta_voluntaria',
  obito = 'obito',
  outra = 'outra',
}

export enum DestinoAltaEnum {
  domicilio = 'domicilio',
  lar = 'lar',
  ucc = 'ucc',
  hospital_referencia = 'hospital_referencia',
  outra_instituicao = 'outra_instituicao',
}

export class AltaEstruturadaDto {
  @ApiProperty({ enum: MotivoAltaEnum })
  @IsEnum(MotivoAltaEnum)
  motivo: string;

  @ApiProperty({ enum: DestinoAltaEnum })
  @IsEnum(DestinoAltaEnum)
  destino: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resumo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prescricao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  medicoFamilia?: string;
}
