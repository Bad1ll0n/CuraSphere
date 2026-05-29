import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, Min, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarSurtoDto {
  @ApiProperty() @IsString() @IsNotEmpty() agente: string;
  @ApiProperty() @IsString() @IsNotEmpty() servico: string;
  @ApiProperty() @IsDateString() dataInicio: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) numCasos?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() medidas?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
