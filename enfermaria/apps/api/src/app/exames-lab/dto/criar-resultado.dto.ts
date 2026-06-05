import { IsString, IsNumber, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CriarResultadoDto {
  @IsString()
  @MaxLength(100)
  doenteId: string;

  @IsString()
  @MaxLength(100)
  parametro: string;

  @IsNumber()
  valor: number;

  @IsString()
  @MaxLength(30)
  unidade: string;

  @IsOptional()
  @IsNumber()
  refMin?: number;

  @IsOptional()
  @IsNumber()
  refMax?: number;

  @IsOptional()
  @IsBoolean()
  alterado?: boolean;

  @IsOptional()
  @IsBoolean()
  critico?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  painel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}
