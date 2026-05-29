import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistroRapidoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipoVisita?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dataNascimento?: string;

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
  telefone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipoCobertura?: string;

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
  entidadeSeguradora?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroApolice?: string;
}
