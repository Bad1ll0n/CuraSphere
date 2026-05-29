import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AtualizarCulturaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() agente?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() antibiograma?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsIn(['pendente','positivo','negativo','contaminado'])
  resultado?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
