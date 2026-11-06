import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FINALIDADES_TRATAMENTO } from '../common/consentimento-tratamento';

export class RegistarConsentimentoTratamentoDto {
  @ApiProperty({ enum: Object.keys(FINALIDADES_TRATAMENTO) })
  @IsIn(Object.keys(FINALIDADES_TRATAMENTO))
  finalidade: string;

  @ApiProperty({ enum: ['consentimento', 'oposicao'] })
  @IsIn(['consentimento', 'oposicao'])
  decisao: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}
