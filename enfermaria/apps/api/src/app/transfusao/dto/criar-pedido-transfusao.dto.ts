import { IsString, IsInt, IsOptional, IsIn, Min, Max, MaxLength } from 'class-validator';

export const COMPONENTES = [
  'concentrado_eritrocitos',
  'plasma_fresco_congelado',
  'concentrado_plaquetas',
  'crioprecipitado',
  'sangue_total',
] as const;

export const GRUPOS_ABO = ['A', 'B', 'AB', 'O'] as const;
export const RH = ['positivo', 'negativo'] as const;
export const URGENCIAS = ['rotina', 'urgente', 'emergencia'] as const;

export class CriarPedidoTransfusaoDto {
  @IsString()
  @IsIn(COMPONENTES as unknown as string[])
  componente: string;

  @IsInt()
  @Min(1)
  @Max(20)
  numeroUnidades: number;

  @IsOptional()
  @IsIn(GRUPOS_ABO as unknown as string[])
  grupoABO?: string;

  @IsOptional()
  @IsIn(RH as unknown as string[])
  rhD?: string;

  @IsOptional()
  @IsIn(URGENCIAS as unknown as string[])
  urgencia?: string;

  @IsString()
  @MaxLength(500)
  indicacao: string;
}
