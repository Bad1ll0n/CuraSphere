import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarMarcacaoQuiosqueDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medicoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dataHora: string;
}
