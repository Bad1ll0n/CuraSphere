import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MotivoAltaEnum {
  melhoria = 'melhoria',
  transferencia = 'transferencia',
  alta_voluntaria = 'alta_voluntaria',
  obito = 'obito',
  outra = 'outra',
}

export enum DestinoAltaEnum {
  domicilio = 'domicilio',
  lar = 'lar',
  ucc = 'ucc',
  rncci = 'rncci',
  hospital_referencia = 'hospital_referencia',
  outra_instituicao = 'outra_instituicao',
}

export const DECISOES_RECONCILIACAO = ['manter', 'alterar', 'suspender', 'nova'] as const;

/** PROD-12: uma linha da reconciliação terapêutica de saída. */
export class LinhaReconciliacaoDto {
  @ApiPropertyOptional({ description: 'Prescrição do internamento a que a decisão se refere (vazio = medicamento novo)' })
  @IsUUID() @IsOptional() medicacaoId?: string;

  @ApiProperty({ enum: DECISOES_RECONCILIACAO })
  @IsIn(DECISOES_RECONCILIACAO as unknown as string[]) decisao!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) nome?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) dose?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) via?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) frequencia?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) notas?: string;
}

/**
 * PROD-12: a ÚNICA via de alta. Os nomes dos campos são os que a web e a mobile já enviavam
 * (`motivoAlta`, `resumoClinical`…) — o DTO antigo declarava outros (`motivo`, `resumo`) e,
 * com `forbidNonWhitelisted`, a alta pela interface era recusada com 400.
 */
export class AltaEstruturadaDto {
  @ApiProperty({ enum: MotivoAltaEnum })
  @IsEnum(MotivoAltaEnum)
  motivoAlta!: string;

  @ApiPropertyOptional({ enum: DestinoAltaEnum })
  @IsEnum(DestinoAltaEnum)
  @IsOptional()
  destino?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  resumoClinical!: string;

  @ApiPropertyOptional({ description: 'Notas para a prescrição de saída (a lista vem da reconciliação)' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  prescricaoSaida?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  medicoFamilia?: string;

  @ApiPropertyOptional({ type: [LinhaReconciliacaoDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LinhaReconciliacaoDto)
  @IsOptional()
  reconciliacao?: LinhaReconciliacaoDto[];

  @ApiPropertyOptional({ description: 'Alta com requisitos em falta: justificação (≥ 15 caracteres)' })
  @IsString()
  @IsOptional()
  @MinLength(15)
  @MaxLength(1000)
  justificacaoRequisitos?: string;
}

/** PROD-12: nota de alta de enfermagem. */
export class NotaAltaEnfermagemDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) autonomia?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) necessidades?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) ensinos?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) dispositivos?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) feridas?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) cuidador?: string;
  @ApiPropertyOptional({ enum: ['nenhuma', 'csp', 'rncci', 'outra'] })
  @IsIn(['nenhuma', 'csp', 'rncci', 'outra']) @IsOptional() referenciacao?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4000) observacoes?: string;
}
