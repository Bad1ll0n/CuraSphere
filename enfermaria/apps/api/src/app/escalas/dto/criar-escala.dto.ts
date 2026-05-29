import { IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TipoEscalaEnum {
  braden = 'braden',
  morse = 'morse',
}

export class CriarEscalaDto {
  @ApiProperty({ enum: TipoEscalaEnum })
  @IsEnum(TipoEscalaEnum)
  tipo: string;

  @ApiProperty()
  @IsObject()
  itens: Record<string, number>;
}
