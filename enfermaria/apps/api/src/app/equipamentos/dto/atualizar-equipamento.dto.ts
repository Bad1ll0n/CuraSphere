import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarEquipamentoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroSerie?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localizacao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  proximaManutencao?: string;
}
