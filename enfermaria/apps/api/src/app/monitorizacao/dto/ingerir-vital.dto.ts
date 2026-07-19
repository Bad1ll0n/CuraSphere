import { IsString, IsOptional, IsInt, IsNumber, IsIn, Min, Max } from 'class-validator';

/**
 * Payload de ingestão de um dispositivo de monitorização. O doenteId pode vir no corpo
 * (ou usa-se o doente ligado ao dispositivo, se registado). Os parâmetros mapeiam para
 * CriarSinalVitalDto e passam pela pipeline NEWS2/sépsis.
 */
export class IngerirVitalDto {
  @IsOptional()
  @IsString()
  doenteId?: string;

  @IsOptional() @IsInt() @Min(0) @Max(300) pressaoSistolica?: number;
  @IsOptional() @IsInt() @Min(0) @Max(200) pressaoDiastolica?: number;
  @IsOptional() @IsInt() @Min(0) @Max(300) pulso?: number;
  @IsOptional() @IsNumber() @Min(25) @Max(45) temperatura?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) saturacaoO2?: number;
  @IsOptional() @IsInt() @Min(0) @Max(80) frequenciaRespiratoria?: number;
  @IsOptional() @IsIn(['A', 'V', 'P', 'U']) avpu?: string;
}
