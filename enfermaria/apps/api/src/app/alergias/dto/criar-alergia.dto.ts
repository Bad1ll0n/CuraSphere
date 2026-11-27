import { IsString, IsOptional, IsEnum, IsNotEmpty, MaxLength, IsIn } from 'class-validator';
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
  @MaxLength(200)
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
  @MaxLength(1000)
  notas?: string;

  // PROD-06: reacção, certeza e fonte (a substância é codificada no servidor).
  @ApiPropertyOptional({ description: 'Reacção observada (ex.: urticária, broncospasmo)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reacao?: string;

  @ApiPropertyOptional({ enum: ['suspeita', 'confirmada'] })
  @IsIn(['suspeita', 'confirmada'])
  @IsOptional()
  certeza?: string;

  @ApiPropertyOptional({ enum: ['doente', 'familia', 'processo', 'observada'] })
  @IsIn(['doente', 'familia', 'processo', 'observada'])
  @IsOptional()
  fonte?: string;
}

/** PROD-06: "perguntámos e não tem" — distinto de "ninguém perguntou". */
export class AvaliacaoAlergiasDto {
  @ApiProperty({ enum: ['sem_alergias_conhecidas'] })
  @IsIn(['sem_alergias_conhecidas'])
  estado: string;
}
