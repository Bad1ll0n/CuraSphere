import { IsString, IsOptional, IsNotEmpty, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarAnuncioDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  titulo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000)
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
