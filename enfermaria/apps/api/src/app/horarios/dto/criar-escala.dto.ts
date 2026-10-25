import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarEscalaDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  mes: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  ano: number;
}
