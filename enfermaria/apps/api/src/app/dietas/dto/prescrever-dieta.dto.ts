import { IsString, IsArray, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { TIPOS_DIETA } from '@org/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescreverDietaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty({ enum: TIPOS_DIETA })
  @IsString()
  @IsIn(TIPOS_DIETA) // ARQ-22: a BD tem um CHECK com os mesmos valores
  tipo: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  restricoes?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
