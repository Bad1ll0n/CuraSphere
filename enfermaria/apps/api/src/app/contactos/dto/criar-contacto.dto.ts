import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarContactoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  relacao: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  telefone: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  principal?: boolean;
}
