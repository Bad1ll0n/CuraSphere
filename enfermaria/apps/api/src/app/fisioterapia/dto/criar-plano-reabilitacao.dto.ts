import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarPlanoReabilitacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  objetivos: string;

  @ApiProperty()
  @IsDateString()
  dataInicio: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataFimPrevista?: string;
}
