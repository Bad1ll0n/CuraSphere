import { IsString, IsOptional, IsIn, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PRIORIDADES_SENHA, TIPOS_SENHA } from '@org/shared';

// ARQ-22: a lista daqui recusava "faturacao" e "geral" (botões do quiosque) e a prioridade
// "senior"; aceitava "administrativo" e "urgente", que não têm letra nem ordem na fila. As
// listas vêm agora de @org/shared — as mesmas do quiosque e do CHECK na base de dados.

export class TirarSenhaDto {
  @ApiProperty()
  @IsString()
  @IsIn(TIPOS_SENHA as string[])
  tipo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(PRIORIDADES_SENHA as unknown as string[])
  prioridade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nomeUtente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s-]{9,15}$/, { message: 'Telefone inválido' })
  telefone?: string;
}
