import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EstadoTarefaEnum {
  pendente = 'pendente',
  em_progresso = 'em_progresso',
  concluida = 'concluida',
  cancelada = 'cancelada',
}

export class AtualizarEstadoTarefaDto {
  @ApiProperty({ enum: EstadoTarefaEnum })
  @IsEnum(EstadoTarefaEnum)
  estado: string;
}
