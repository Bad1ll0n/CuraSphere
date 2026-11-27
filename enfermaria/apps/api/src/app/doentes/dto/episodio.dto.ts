import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** PROD-02: reinternar uma pessoa que já teve alta (mantém alergias, antecedentes, contactos). */
export class ReinternarDto {
  @ApiPropertyOptional({ description: 'Cama; sem ela o doente fica a aguardar cama' })
  @IsUUID()
  @IsOptional()
  camaId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  diagnosticoPrincipal!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(20)
  icd10Code?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataAltaPrevista?: string;

  @ApiPropertyOptional({ description: 'Excepção de cama (sexo/isolamento incompatível)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  justificacaoCama?: string;
}

/** PROD-03: transferência interna de cama ou de serviço. */
export class TransferirInternoDto {
  @ApiProperty()
  @IsUUID()
  camaId!: string;

  @ApiProperty({ description: 'Motivo (agravamento, isolamento, pedido do serviço…)' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;

  @ApiPropertyOptional({ description: 'Excepção de cama (sexo/isolamento incompatível)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  justificacaoCama?: string;
}
