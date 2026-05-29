import { IsString, IsOptional, IsNotEmpty, IsIn, IsNumber, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PreNotificacaoDto {
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

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  etaMinutos: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condicaoPrevia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sinaisVitaisTriagem?: object;
}
