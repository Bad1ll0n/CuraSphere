import { IsString, IsOptional, IsDateString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdmitirDoenteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty()
  @IsDateString()
  dataNascimento: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  diagnosticoPrincipal: string;

  @ApiPropertyOptional({ description: 'Código ICD-10-CM (ex: J18.9)' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  icd10Code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroProcesso?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  camaId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataAltaPrevista?: string;

  // Dados administrativos opcionais (ficha pessoal)
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nif?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroSNS?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  morada?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codigoPostal?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localidade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefone?: string;
}
