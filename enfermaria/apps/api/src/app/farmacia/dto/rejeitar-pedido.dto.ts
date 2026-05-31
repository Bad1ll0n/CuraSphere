import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejeitarPedidoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivoRejeicao: string;
}
