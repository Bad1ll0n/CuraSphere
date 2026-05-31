import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarTransferenciaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  servicoDestino: string;

  @ApiProperty()
  @IsNumber()
  quantidade: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motivo?: string;
}
