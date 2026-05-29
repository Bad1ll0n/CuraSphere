import { IsString, IsOptional, IsNumber, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AgendarCirurgiaDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  doenteId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  designacao: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  dataHora: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  duracaoPrevista: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sala: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anestesistaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  equipa?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notasPreOperatorio?: string;
}
