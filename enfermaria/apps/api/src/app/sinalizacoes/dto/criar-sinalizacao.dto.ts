import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';

export class CriarSinalizacaoDto {
  @IsString()
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsEnum(['normal', 'urgente'])
  nivelUrgencia?: 'normal' | 'urgente';
}
