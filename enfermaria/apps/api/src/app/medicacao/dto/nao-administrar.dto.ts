import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NaoAdministrarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
