import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarTrocaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  turnoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinatarioId: string;
}
