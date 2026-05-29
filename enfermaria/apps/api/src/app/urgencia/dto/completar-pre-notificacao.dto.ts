import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompletarPreNotificacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doenteId?: string;

  @ApiPropertyOptional({ enum: ['verde', 'amarelo', 'laranja', 'vermelho', 'azul'] })
  @IsOptional()
  @IsIn(['verde', 'amarelo', 'laranja', 'vermelho', 'azul'])
  triagem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sinaisVitaisTriagem?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
