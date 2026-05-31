import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  chave: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ordem?: number;
}
