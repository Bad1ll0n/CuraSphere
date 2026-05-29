import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotaTurnoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  turnoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  texto: string;
}
