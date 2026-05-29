import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoAlergiaEnum {
  medicamento = 'medicamento',
  alimento = 'alimento',
  ambiental = 'ambiental',
  contraste = 'contraste',
  latex = 'latex',
  outros = 'outros',
}

export enum SeveridadeAlergiaEnum {
  leve = 'leve',
  moderada = 'moderada',
  grave = 'grave',
  anafilaxia = 'anafilaxia',
}

export class CriarAlergiaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  alergenio: string;

  @ApiProperty({ enum: TipoAlergiaEnum })
  @IsEnum(TipoAlergiaEnum)
  tipo: string;

  @ApiProperty({ enum: SeveridadeAlergiaEnum })
  @IsEnum(SeveridadeAlergiaEnum)
  severidade: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notas?: string;
}
