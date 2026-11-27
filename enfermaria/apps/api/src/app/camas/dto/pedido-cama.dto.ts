import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const ORIGENS_PEDIDO_CAMA = ['urgencia', 'bloco', 'consulta', 'servico', 'admissao'] as const;

export class CriarPedidoCamaDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() doenteId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() episodioUrgenciaId?: string;
  @ApiPropertyOptional({ description: 'Doente ainda sem registo' }) @IsString() @IsOptional() @MaxLength(120) nomeTemporario?: string;

  @ApiProperty({ enum: ORIGENS_PEDIDO_CAMA }) @IsIn(ORIGENS_PEDIDO_CAMA as unknown as string[]) origem!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) servicoDestino!: string;

  @ApiPropertyOptional({ enum: ['masculino', 'feminino', 'indeterminado'] })
  @IsIn(['masculino', 'feminino', 'indeterminado']) @IsOptional() sexo?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isolamento?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) motivoIsolamento?: string;
  @ApiPropertyOptional({ enum: ['normal', 'urgente'] }) @IsIn(['normal', 'urgente']) @IsOptional() prioridade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) diagnostico?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) notas?: string;
}

export class AtribuirCamaPedidoDto {
  @ApiProperty() @IsUUID() camaId!: string;
  @ApiPropertyOptional({ description: 'Excepção de cama (sexo/isolamento incompatível), ≥ 10 caracteres' })
  @IsString() @IsOptional() @MaxLength(500) justificacao?: string;
}

export class OcuparPedidoCamaDto {
  @ApiPropertyOptional({ description: 'Doente, se o pedido foi feito só com nome temporário' }) @IsUUID() @IsOptional() doenteId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) diagnosticoPrincipal?: string;
}

export class CancelarPedidoCamaDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) motivo!: string;
}

/** PROD-03: atributos reais da cama. */
export class AtributosCamaDto {
  @ApiPropertyOptional({ enum: ['masculino', 'feminino'], nullable: true, description: 'null = enfermaria mista' })
  @IsIn(['masculino', 'feminino', null]) @IsOptional() sexo?: string | null;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isolamento?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(80) especialidade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(80) servico?: string;
}
