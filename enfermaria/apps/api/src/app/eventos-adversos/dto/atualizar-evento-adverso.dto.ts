import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarEventoAdversoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acaoCorretiva?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estado?: string;
}
