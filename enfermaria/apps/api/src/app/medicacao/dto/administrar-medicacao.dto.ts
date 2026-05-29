import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdministrarMedicacaoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  verificacao5Certas?: boolean;
}
