import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarNotasPosDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  notasPosOperatorio: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complicacoes?: string;
}
