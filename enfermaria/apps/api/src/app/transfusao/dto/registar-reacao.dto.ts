import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export const TIPOS_REACAO = [
  'febril_nao_hemolitica',
  'alergica',
  'hemolitica_aguda',
  'trali',
  'taco',
  'contaminacao_bacteriana',
  'outra',
] as const;

export const GRAVIDADES = ['ligeira', 'moderada', 'grave', 'fatal'] as const;

export class RegistarReacaoDto {
  @IsIn(TIPOS_REACAO as unknown as string[])
  tipo: string;

  @IsIn(GRAVIDADES as unknown as string[])
  gravidade: string;

  @IsString()
  @MaxLength(1000)
  sintomas: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medidas?: string;
}
