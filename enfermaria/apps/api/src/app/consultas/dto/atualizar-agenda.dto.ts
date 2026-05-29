import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AtualizarAgendaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  horaInicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  horaFim?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  duracaoSlot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
