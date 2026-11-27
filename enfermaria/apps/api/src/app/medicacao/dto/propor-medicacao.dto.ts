import { IsString, IsOptional, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProporMedicacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dose: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  via: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frequencia: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;

  // QA-08: SOS.
  @IsInt()
  @Min(1)
  @Max(72)
  @IsOptional()
  intervaloMinimoH?: number;

  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  maxDosesDia?: number;
}
