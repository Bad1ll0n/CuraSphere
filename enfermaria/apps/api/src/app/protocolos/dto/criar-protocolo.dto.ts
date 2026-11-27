import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { TIPOS_PROTOCOLO_CLINICO } from '@org/shared';
import { ApiProperty } from '@nestjs/swagger';

export class CriarProtocoloDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty({ enum: TIPOS_PROTOCOLO_CLINICO })
  @IsString()
  @IsIn(TIPOS_PROTOCOLO_CLINICO) // ARQ-22: a BD tem um CHECK com os mesmos valores
  tipo: string;
}
