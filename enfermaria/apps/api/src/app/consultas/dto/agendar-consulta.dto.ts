import { IsString, IsOptional, IsNumber, IsNotEmpty, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AgendarConsultaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeDoente?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  medicoId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  especialidade: string;

  @ApiProperty()
  @IsDateString()
  dataHora: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  duracao?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional({ enum: ['presencial', 'teleconsulta'] })
  @IsOptional()
  @IsIn(['presencial', 'teleconsulta'])
  tipo?: string;
}
