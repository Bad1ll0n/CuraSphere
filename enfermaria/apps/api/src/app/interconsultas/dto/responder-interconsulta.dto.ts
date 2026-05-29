import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResponderInterconsultaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resposta: string;
}
