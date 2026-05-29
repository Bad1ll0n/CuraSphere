import { IsString, IsNotEmpty, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AgendarSessaoFisioterapiaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planoId: string;

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;
}
