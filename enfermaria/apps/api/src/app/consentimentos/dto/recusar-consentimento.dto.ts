import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecusarConsentimentoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
