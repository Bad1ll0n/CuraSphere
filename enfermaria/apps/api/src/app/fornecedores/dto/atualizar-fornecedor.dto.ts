import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarFornecedorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nif?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  morada?: string;
}
