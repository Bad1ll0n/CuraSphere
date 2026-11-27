import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AtivarBreakGlassDto {
  @ApiProperty()
  @IsUUID()
  doenteId: string;

  /** SEC-14: a justificação tem de dizer alguma coisa (antes bastava 1 carácter). */
  @ApiProperty({ minLength: 20, maxLength: 500 })
  @IsString()
  @MinLength(20, { message: 'A justificação do acesso de emergência tem de ter pelo menos 20 caracteres' })
  @MaxLength(500)
  motivo: string;
}

export const RESULTADOS_REVISAO = ['justificado', 'injustificado'] as const;

/** SEC-14: revisão de um acesso de emergência. */
export class ReverBreakGlassDto {
  @ApiProperty({ enum: RESULTADOS_REVISAO })
  @IsIn(RESULTADOS_REVISAO as unknown as string[])
  resultado: (typeof RESULTADOS_REVISAO)[number];

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}
