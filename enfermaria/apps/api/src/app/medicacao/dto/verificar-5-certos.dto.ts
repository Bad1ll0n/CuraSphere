import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * BE-01 — `POST /v1/medicacao/verificar-5-certos` recebia
 * `@Body() body: { qrPayload: string; doenteIdEsperado: string }`. O tipo inline é apagado
 * na compilação, o metatype emitido é `Object` e a `ValidationPipe` global não validava
 * nada — num endpoint que é, precisamente, a verificação de segurança da administração de
 * medicação (as "5 certas"). Um corpo sem `doenteIdEsperado`, ou com um tipo inesperado,
 * chegava ao serviço.
 */
export class Verificar5CertosDto {
  @ApiProperty({ description: 'Conteúdo lido do código QR da prescrição' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  qrPayload: string;

  @ApiProperty({ description: 'Doente que o profissional tem à frente — o "doente certo"' })
  @IsUUID()
  doenteIdEsperado: string;
}
