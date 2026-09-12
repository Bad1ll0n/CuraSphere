import {
  IsString, IsNotEmpty, IsEmail, IsObject, IsArray, IsUUID, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * BE-01 — DTO do portal do doente.
 *
 * A `ValidationPipe` global (`main.ts:106`) está bem configurada
 * (`whitelist`, `forbidNonWhitelisted`, `transform`), mas estes handlers declaravam o corpo
 * com uma anotação de tipo TS inline (`@Body() body: { email: string; senha: string }`).
 * O TypeScript apaga esses tipos na compilação: o `design:paramtypes` emitido é `Object`,
 * a pipe não encontra metadados de validação e **não valida absolutamente nada**. O corpo
 * chegava ao serviço tal como veio do cliente.
 *
 * Uma classe com decorators de `class-validator` sobrevive à compilação e é o que faz a
 * pipe global entrar em acção.
 */

export class PortalLoginDto {
  // Endpoint PÚBLICO — a validação aqui é a primeira barreira antes do bcrypt.
  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(320)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  senha: string;
}

export class CriarAcessoPortalDto {
  @ApiProperty()
  @IsUUID()
  doenteId: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(320)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(12, { message: 'A senha deve ter pelo menos 12 caracteres' })
  @MaxLength(200)
  senha: string;
}

export class MensagemPortalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  conteudo: string;
}

export class SubmeterProDto {
  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  respostas: Record<string, unknown>;
}

export class CriarTemplateProDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  @IsArray()
  @IsObject({ each: true })
  campos: object[];
}
