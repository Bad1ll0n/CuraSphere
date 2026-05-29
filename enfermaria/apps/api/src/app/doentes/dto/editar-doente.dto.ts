import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditarDoenteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diagnosticoPrincipal?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataAltaPrevista?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroProcesso?: string;
}
