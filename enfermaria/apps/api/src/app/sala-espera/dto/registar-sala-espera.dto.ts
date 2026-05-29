import { IsString, IsOptional, IsNumber, IsNotEmpty, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RegistarSalaEsperaDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  nomeDoente: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numeroUtente?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  motivo: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  prioridade?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
