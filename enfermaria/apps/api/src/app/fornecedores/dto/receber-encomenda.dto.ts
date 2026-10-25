import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReceberEncomendaDto {
  @ApiProperty()
  @IsNumber()
  quantidadeRecebida: number;
}
