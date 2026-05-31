import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarEquipamentoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipo: string;

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
  proximaManutencao?: string;
}
