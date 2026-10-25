import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditarTurnoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  profissionaisIds?: string[];
}
