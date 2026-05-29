import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PrioridadeTarefaEditarEnum {
  baixa = 'baixa',
  media = 'media',
  alta = 'alta',
  urgente = 'urgente',
}

export class EditarTarefaDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ enum: PrioridadeTarefaEditarEnum })
  @IsEnum(PrioridadeTarefaEditarEnum)
  @IsOptional()
  prioridade?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  prazo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  grupoResponsavel?: string;
}
