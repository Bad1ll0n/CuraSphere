import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotaDoenteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  texto: string;
}
