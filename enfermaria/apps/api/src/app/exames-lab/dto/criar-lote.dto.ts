import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CriarResultadoDto } from './criar-resultado.dto';

/**
 * BE-01 — `POST /v1/exames-lab/lote` recebia `@Body() body: { resultados: CriarResultadoDto[] }`.
 * O tipo inline é apagado na compilação: apesar de `CriarResultadoDto` ser uma classe com
 * decorators, a `ValidationPipe` nunca chegava a vê-la, porque o metatype do parâmetro era
 * `Object`. Cada elemento do lote passa agora pela mesma validação do endpoint singular.
 */
export class CriarLoteResultadosDto {
  @ApiProperty({ type: [CriarResultadoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CriarResultadoDto)
  resultados: CriarResultadoDto[];
}
