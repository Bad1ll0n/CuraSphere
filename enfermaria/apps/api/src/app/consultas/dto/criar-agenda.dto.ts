import { IsString, IsOptional, IsNumber, IsBoolean, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarAgendaDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  medicoId: string;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  horaInicio: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  horaFim: string;

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
