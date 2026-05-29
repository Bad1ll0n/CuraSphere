import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoTarefaEnum {
  clinica = 'clinica',
  enfermagem = 'enfermagem',
  administrativa = 'administrativa',
  higiene = 'higiene',
}

export enum PrioridadeTarefaEnum {
  baixa = 'baixa',
  media = 'media',
  alta = 'alta',
  urgente = 'urgente',
}

export class CriarTarefaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiProperty({ enum: TipoTarefaEnum })
  @IsEnum(TipoTarefaEnum)
  tipo: string;

  @ApiProperty({ enum: PrioridadeTarefaEnum })
  @IsEnum(PrioridadeTarefaEnum)
  prioridade: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  grupoResponsavel?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  prazo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  responsavelId?: string;
}
