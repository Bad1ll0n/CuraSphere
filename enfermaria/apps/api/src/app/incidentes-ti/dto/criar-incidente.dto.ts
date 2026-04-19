import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TipoIncidenteTI, PrioridadeIncidenteTI } from '../../../generated/prisma';

export class CriarIncidenteDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsEnum(TipoIncidenteTI)
  tipo: TipoIncidenteTI;

  @IsOptional()
  @IsEnum(PrioridadeIncidenteTI)
  prioridade?: PrioridadeIncidenteTI;
}
