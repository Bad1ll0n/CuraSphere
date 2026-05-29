import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarNotaClinicaDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subjetivo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  objetivo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avaliacao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  plano?: string;
}
