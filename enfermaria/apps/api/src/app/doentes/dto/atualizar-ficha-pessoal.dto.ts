import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarFichaPessoalDto {
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entidadeSeguradora?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroApolice?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipoCobertura?: string;
}
