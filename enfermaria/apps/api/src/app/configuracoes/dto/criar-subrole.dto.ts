import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarSubRoleDto {
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
  roleChave: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ordem?: number;
}
