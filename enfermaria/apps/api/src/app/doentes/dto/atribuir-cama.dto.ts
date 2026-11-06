import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** PROD-01: cama para um doente registado para internamento que ainda aguarda cama. */
export class AtribuirCamaDto {
  @ApiProperty()
  @IsUUID()
  camaId!: string;
}
