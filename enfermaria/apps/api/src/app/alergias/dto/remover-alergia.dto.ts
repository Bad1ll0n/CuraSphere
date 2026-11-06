import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoverAlergiaDto {
  @ApiProperty({ description: 'Porque é que a alergia deixa de se aplicar (ex.: "teste de provocação negativo em 03/11")' })
  @IsString()
  @MinLength(10, { message: 'Indique o motivo da remoção (mínimo 10 caracteres)' })
  @MaxLength(500)
  motivo: string;
}
