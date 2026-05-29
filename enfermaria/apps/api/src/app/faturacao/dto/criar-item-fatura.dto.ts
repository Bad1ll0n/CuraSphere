import { IsString, IsOptional, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarItemFaturaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  quantidade?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario: number;
}
