import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RegistarDispositivoDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  localizacao?: string;

  // Utilizador (clínico/sistema) que fica como autor dos vitais ingeridos por este dispositivo.
  @IsString()
  responsavelId: string;

  @IsOptional()
  @IsString()
  doenteId?: string;
}
