import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CriarSessaoEspecialidadeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsDateString()
  data: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  duracao: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;
}
