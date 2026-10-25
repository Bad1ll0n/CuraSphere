import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarManutencaoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tecnicoId?: string;
}
