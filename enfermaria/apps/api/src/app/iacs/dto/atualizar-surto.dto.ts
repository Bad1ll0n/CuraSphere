import { IsString, IsOptional, IsDateString, IsInt, Min, IsObject, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarSurtoDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['activo','controlado','encerrado']) estado?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) numCasos?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataFim?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() medidas?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
