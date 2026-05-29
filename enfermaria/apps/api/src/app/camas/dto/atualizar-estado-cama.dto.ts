import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EstadoCamaEnum {
  disponivel = 'disponivel',
  ocupada = 'ocupada',
  em_limpeza = 'em_limpeza',
  em_manutencao = 'em_manutencao',
  reservada = 'reservada',
}

export class AtualizarEstadoCamaDto {
  @ApiProperty({ enum: EstadoCamaEnum })
  @IsEnum(EstadoCamaEnum)
  estado: string;
}
