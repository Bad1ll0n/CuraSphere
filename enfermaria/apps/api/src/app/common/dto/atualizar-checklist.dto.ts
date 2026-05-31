import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AtualizarChecklistDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  estado: string;
}
