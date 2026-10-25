import { IsNumber, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GerarAutomaticoDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  mes: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  ano: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  servico?: string;
}
