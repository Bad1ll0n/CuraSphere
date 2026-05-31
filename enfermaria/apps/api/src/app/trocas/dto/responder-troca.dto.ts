import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResponderTrocaDto {
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  aceitar: boolean;
}
