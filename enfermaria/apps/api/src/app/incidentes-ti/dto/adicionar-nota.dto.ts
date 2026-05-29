import { IsString, MinLength, MaxLength } from 'class-validator';

export class AdicionarNotaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  conteudo: string;
}
