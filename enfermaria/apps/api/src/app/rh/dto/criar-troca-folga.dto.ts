import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarTrocaFolgaDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  destinatarioId: string;

  @ApiProperty()
  @IsDateString()
  dataOrigem: string;

  @ApiProperty()
  @IsDateString()
  dataDestino: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}
