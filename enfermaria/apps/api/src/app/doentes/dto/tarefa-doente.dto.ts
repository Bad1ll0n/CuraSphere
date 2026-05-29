import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoTarefaDoenteEnum {
  clinica = 'clinica',
  enfermagem = 'enfermagem',
  administrativa = 'administrativa',
  higiene = 'higiene',
}

export enum PrioridadeTarefaDoenteEnum {
  baixa = 'baixa',
  media = 'media',
  alta = 'alta',
  urgente = 'urgente',
}

export class TarefaDoenteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiProperty({ enum: TipoTarefaDoenteEnum })
  @IsEnum(TipoTarefaDoenteEnum)
  tipo: string;

  @ApiProperty({ enum: PrioridadeTarefaDoenteEnum })
  @IsEnum(PrioridadeTarefaDoenteEnum)
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
