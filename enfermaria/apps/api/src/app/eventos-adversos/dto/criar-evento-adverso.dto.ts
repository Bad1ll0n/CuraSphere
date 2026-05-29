import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarEventoAdversoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tipo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  gravidade: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servicoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acaoCorretiva?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ocorridoEm?: string;
}
