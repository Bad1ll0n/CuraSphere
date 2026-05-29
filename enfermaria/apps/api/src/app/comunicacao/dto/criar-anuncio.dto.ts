import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarAnuncioDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  titulo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  texto: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiraEm?: string;
}
