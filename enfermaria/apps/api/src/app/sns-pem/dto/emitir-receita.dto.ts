import { IsArray, IsOptional, IsString, ValidateNested, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class PemItemDto {
  @IsString() @MaxLength(200) nome: string;
  @IsOptional() @IsString() @MaxLength(60) dose?: string;
  @IsOptional() @IsString() @MaxLength(60) via?: string;
  @IsOptional() @IsString() @MaxLength(60) frequencia?: string;
  @IsOptional() quantidade?: number;
}

export class EmitirReceitaDto {
  @IsOptional() @IsString() numeroUtenteSNS?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PemItemDto)
  medicamentos: PemItemDto[];
}
