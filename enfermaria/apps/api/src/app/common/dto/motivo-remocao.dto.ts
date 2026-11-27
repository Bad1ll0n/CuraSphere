import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** ARQ-04: um registo clínico não se apaga — remove-se com motivo, que fica guardado. */
export class MotivoRemocaoDto {
  @ApiProperty({ description: 'Porque é que o registo é removido (ex.: "registado no doente errado")' })
  @IsString()
  @MinLength(10, { message: 'Indique o motivo da remoção (mínimo 10 caracteres)' })
  @MaxLength(500)
  motivo!: string;
}
