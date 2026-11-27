import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { TIPOS_CONSENTIMENTO_INFORMADO } from '@org/shared';
import { ApiProperty } from '@nestjs/swagger';

export class CriarConsentimentoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty({ enum: TIPOS_CONSENTIMENTO_INFORMADO })
  @IsString()
  @IsIn(TIPOS_CONSENTIMENTO_INFORMADO) // ARQ-22: a BD tem um CHECK com os mesmos valores
  tipo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descricao: string;
}
