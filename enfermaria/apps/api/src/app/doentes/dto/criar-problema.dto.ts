import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarProblemaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataInicio?: string;
}
