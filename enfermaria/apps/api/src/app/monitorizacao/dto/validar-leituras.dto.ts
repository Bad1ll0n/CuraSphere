import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

/** PROD-15 — validação em lote das leituras de monitor pendentes de um doente. */
export class ValidarLeiturasDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true })
  ids: string[];
}

export class RejeitarLeiturasDto extends ValidarLeiturasDto {
  /** Porque não é uma leitura verdadeira (sensor solto, doente em movimento…). */
  @IsString() @MinLength(5) @MaxLength(500)
  motivo: string;
}
