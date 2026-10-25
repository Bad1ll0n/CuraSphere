import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarProblemaDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataFim?: string;
}
