import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RegistarDispositivoDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  localizacao?: string;

  // Responsável administrativo pelo dispositivo. PROD-15: já não é o autor dos vitais — o autor
  // é o enfermeiro que valida a leitura.
  @IsString()
  responsavelId: string;

  @IsOptional()
  @IsString()
  doenteId?: string;

  /** PROD-15: a cama a que o monitor está ligado — o doente é quem a ocupa no momento da leitura. */
  @IsOptional()
  @IsString()
  camaId?: string;
}
