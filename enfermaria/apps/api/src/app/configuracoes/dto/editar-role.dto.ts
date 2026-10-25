import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditarRoleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ordem?: number;
}
