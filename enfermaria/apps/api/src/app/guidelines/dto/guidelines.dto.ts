import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BE-01 — os handlers de `guidelines` declaravam o corpo com tipos inline, que o
 * TypeScript apaga: a `ValidationPipe` global recebia o metatype `Object` e não validava.
 */
export class CriarGuidelineDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  categoria: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(200000)
  conteudo: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(300)
  fonte: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(50)
  versao?: string;
}

/**
 * Metadados que acompanham o upload do PDF (multipart). Os campos chegam sempre como
 * string no `multipart/form-data`, por isso não há aqui coerção numérica nenhuma.
 */
export class UploadGuidelinePdfDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  categoria: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(300)
  fonte: string;
}
