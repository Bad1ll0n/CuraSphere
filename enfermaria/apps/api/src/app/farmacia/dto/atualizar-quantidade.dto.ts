import { IsNumber, IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AtualizarQuantidadeDto {
  @ApiProperty()
  @IsNumber()
  quantidade: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiProperty({ enum: ['entrada', 'saida', 'ajuste'] })
  @IsIn(['entrada', 'saida', 'ajuste'])
  tipo: string;
}
