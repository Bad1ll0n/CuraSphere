import { Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsNumber, IsArray,
  ValidateNested, MaxLength, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BE-01 — DTO do módulo de IA clínica.
 *
 * Estes handlers declaravam o corpo com interfaces TS (`EpisodioTriagem`, `DoenteTurno`) ou
 * com tipos inline. Ambos são apagados na compilação: o metatype emitido é `Object` e a
 * `ValidationPipe` global não valida nada.
 *
 * O risco aqui não é só de robustez: o texto destes corpos é interpolado em prompts
 * enviados ao Claude (ver `ai-clinico.service.ts`). Sem limite de comprimento, o corpo é
 * simultaneamente um vector de custo (tokens facturados) e de injecção de prompt. Os
 * `@MaxLength` abaixo são a primeira barreira; a sanitização do prompt continua a ser
 * responsabilidade do serviço.
 */

export class EpisodioTriagemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  queixaPrincipal: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(130)
  idadeAproximada?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  sexo?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(3) @Max(15)
  glasgow?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  consciente?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  mecanismo?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(300)
  vitalsPASistolica?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(300)
  vitalsPADiastolica?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(300)
  vitalsFC?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(100)
  vitalsSpO2?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(100)
  vitalsFR?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Max(30)
  news2Triagem?: number | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  condicaoPrevia?: string | null;
}

export class DoenteTurnoDto {
  @ApiProperty()
  @IsString() @MaxLength(200)
  nome: string;

  @ApiProperty()
  @IsString() @MaxLength(50)
  cama: string;

  @ApiProperty()
  @IsString() @MaxLength(1000)
  diagnostico: string;

  @ApiProperty({ nullable: true })
  @IsOptional() @IsNumber()
  news2: number | null;

  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) @MaxLength(500, { each: true })
  alertas: string[];

  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) @MaxLength(500, { each: true })
  tarefasPendentes: string[];
}

export class SumarizarTurnoDto {
  @ApiProperty({ type: [DoenteTurnoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DoenteTurnoDto)
  doentes: DoenteTurnoDto[];
}

export class SumarizarTurnoServicoDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  servico: string;
}

export class ExecutarNlqDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(2000)
  query: string;
}

export class FeedbackDecisaoDto {
  @ApiProperty()
  @IsBoolean()
  aceite: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  overrideMotivo?: string;
}
