import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditarUtilizadorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ordemExperiencia?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subRole?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  servico?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  equipa?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  chefeId?: string | null;
}
