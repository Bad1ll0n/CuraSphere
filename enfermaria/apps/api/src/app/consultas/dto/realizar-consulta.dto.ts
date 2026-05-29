import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RealizarConsultaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnostico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proximaConsulta?: string;
}
