import { IsString, IsOptional, IsNotEmpty, IsIn, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistarEntradaUrgenciaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeTemporario?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  queixaPrincipal: string;

  @ApiProperty({ enum: ['verde', 'amarelo', 'laranja', 'vermelho', 'azul'] })
  @IsIn(['verde', 'amarelo', 'laranja', 'vermelho', 'azul'])
  triagem: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sinaisVitaisTriagem?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
