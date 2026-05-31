import { IsString, IsOptional, IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarAtoClinicoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @ApiProperty()
  @IsNumber()
  precoBase: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  especialidade?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
