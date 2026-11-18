import { IsString, IsOptional, IsInt, IsNumber, IsIn, IsISO8601, Min, Max } from 'class-validator';

/**
 * Payload de ingestão de um dispositivo de monitorização. PROD-15: o doente vem SEMPRE do
 * dispositivo (cama ou doente associado); `doenteId` no corpo só serve de verificação — se
 * nomear outro doente, a leitura é recusada. A leitura fica pendente de validação de enfermagem.
 */
export class IngerirVitalDto {
  @IsOptional()
  @IsString()
  doenteId?: string;

  /** Hora da medição no monitor (ISO 8601). Sem ela, a hora de chegada. */
  @IsOptional() @IsISO8601() medidoEm?: string;

  @IsOptional() @IsInt() @Min(0) @Max(300) pressaoSistolica?: number;
  @IsOptional() @IsInt() @Min(0) @Max(200) pressaoDiastolica?: number;
  @IsOptional() @IsInt() @Min(0) @Max(300) pulso?: number;
  @IsOptional() @IsNumber() @Min(25) @Max(45) temperatura?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) saturacaoO2?: number;
  @IsOptional() @IsInt() @Min(0) @Max(80) frequenciaRespiratoria?: number;
  @IsOptional() @IsIn(['A', 'V', 'P', 'U']) avpu?: string;
}
