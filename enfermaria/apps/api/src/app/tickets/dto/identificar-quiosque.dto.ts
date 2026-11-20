import { Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** SEC-12: o utente identifica-se no quiosque com o NIF e a data de nascimento. */
export class IdentificarQuiosqueDto {
  @ApiProperty({ example: '123456789' })
  @Matches(/^\d{9}$/, { message: 'NIF inválido — 9 dígitos' })
  nif: string;

  @ApiProperty({ example: '1960-01-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de nascimento no formato AAAA-MM-DD' })
  dataNascimento: string;
}
