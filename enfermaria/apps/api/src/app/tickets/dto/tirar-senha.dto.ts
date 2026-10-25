import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TirarSenhaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prioridade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nomeUtente?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefone?: string;
}
