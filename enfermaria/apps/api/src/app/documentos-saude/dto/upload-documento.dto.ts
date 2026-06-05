import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class UploadDocumentoDto {
  @IsString()
  @MaxLength(100)
  tipo: string; // 'rx'|'tc'|'rmn'|'eco'|'ecg'|'lab'|'alta'|'prescricao'|'vacinacao'|'patologia'|'outro'

  @IsString()
  @MaxLength(255)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsDateString()
  dataDocumento: string;

  @IsString()
  @MaxLength(200)
  origem: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  modalidadeDicom?: string;
}
