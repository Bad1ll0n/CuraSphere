import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnviarBroadcastDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servicoAlvo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleAlvo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assunto?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  texto: string;
}
