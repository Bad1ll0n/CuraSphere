import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoIncidenteTI, PrioridadeIncidenteTI } from '../../../generated/prisma';

export class AtualizarIncidenteDto {
  @IsOptional()
  @IsEnum(EstadoIncidenteTI)
  estado?: EstadoIncidenteTI;

  @IsOptional()
  @IsEnum(PrioridadeIncidenteTI)
  prioridade?: PrioridadeIncidenteTI;

  @IsOptional()
  @IsString()
  responsavelId?: string;
}
