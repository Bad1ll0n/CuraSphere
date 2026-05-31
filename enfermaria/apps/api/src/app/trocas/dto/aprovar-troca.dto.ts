import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AprovarTrocaDto {
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  aprovar: boolean;
}
