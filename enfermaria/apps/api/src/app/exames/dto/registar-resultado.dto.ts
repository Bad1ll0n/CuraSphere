import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarResultadoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resultado: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataResultado?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
