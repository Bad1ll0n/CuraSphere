import { IsString, IsInt, IsOptional, IsIn, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { COMPONENTES, GRUPOS_ABO, RH } from './criar-pedido-transfusao.dto';

export class AdicionarBolsaDto {
  @IsString()
  @MaxLength(60)
  numeroUnidade: string;

  @IsIn(COMPONENTES as unknown as string[])
  componente: string;

  @IsIn(GRUPOS_ABO as unknown as string[])
  grupoABO: string;

  @IsIn(RH as unknown as string[])
  rhD: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(1000)
  volumeMl?: number;

  @IsOptional()
  @IsDateString()
  dataColheita?: string;

  @IsDateString()
  dataValidade: string;
}
