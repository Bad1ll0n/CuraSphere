import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarCatalogoItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dci: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomeMarca?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  formaFarmaceutica: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  classeTerap: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unidade: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  concentracao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codigoATC?: string;
}
