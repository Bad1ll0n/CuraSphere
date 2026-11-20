import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** SEC-12: sem `doenteId` — o doente é o identificado no quiosque (cabeçalho de identificação). */
export class CriarMarcacaoQuiosqueDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medicoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dataHora: string;
}
