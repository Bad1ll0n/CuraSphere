import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarCatalogoItemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dci?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomeMarca?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  formaFarmaceutica?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  classeTerap?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unidade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  concentracao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codigoATC?: string;
}
